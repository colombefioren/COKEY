import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import type { Cokey } from "../core/cokey.js";
import { makeAuthHook } from "./middleware/auth.js";
import { registerCatalogRoutes } from "./routes/catalog.js";
import { registerContentRoutes } from "./routes/content.js";
import { registerManagementRoutes } from "./routes/management.js";
import { registerOpenAiRoutes } from "./routes/openai.js";
import { registerProxyPoolRoutes } from "./routes/proxy-pool.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { SessionStore } from "./session.js";

export interface ServerOptions {
  /** Serve the built web UI. Disabled in tests. */
  serveUi?: boolean;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/** Locate the built UI, whether running from `dist/` or from source. */
export function resolveUiDirectory(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, "..", "..", "dist", "web"), join(here, "..", "web")];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "index.html"))) return resolve(candidate);
  }
  return resolve(candidates[0]!);
}

/**
 * Build the COKEY HTTP server.
 *
 * Three surfaces live here:
 *   - `/v1/*`  the OpenAI-compatible gateway
 *   - `/api/*` the management API used by the UI and the CLI
 *   - `/`      the built React UI (when present)
 *
 * The UI is public so the login form can render; every API call it makes is
 * gated by a session cookie or an API key.
 */
export async function createServer(
  cokey: Cokey,
  options: ServerOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    bodyLimit: 64 * 1024 * 1024,
    disableRequestLogging: true,
  });

  const sessions = new SessionStore();

  app.addHook(
    "onRequest",
    makeAuthHook({
      sessions,
      verifyApiKey: (presented) => cokey.verifyApiKey(presented),
      verifyPassword: (password) => cokey.verifyPassword(password),
    }),
  );

  registerOpenAiRoutes(app, cokey);
  registerManagementRoutes(app, cokey);
  registerCatalogRoutes(app, cokey);
  registerContentRoutes(app, cokey);
  registerProxyPoolRoutes(app, cokey);
  registerStatsRoutes(app, cokey);
  registerSessionRoutes(app, cokey, sessions);

  if (options.serveUi !== false) {
    registerUi(app);
  }

  app.setNotFoundHandler((request, reply) => {
    const url = request.url;
    if (url.startsWith("/api") || url.startsWith("/v1")) {
      return reply.code(404).send({
        error: { message: `No route for ${request.method} ${url}`, type: "not_found" },
      });
    }
    if (request.method === "GET" && options.serveUi !== false) {
      const raw = readUiFile("index.html");
      if (raw) {
        return reply.type(MIME_TYPES[".html"]!).send(raw);
      }
    }
    return reply.code(404).send({ error: { message: "Not found", type: "not_found" } });
  });

  return app;
}

function registerSessionRoutes(app: FastifyInstance, cokey: Cokey, sessions: SessionStore): void {
  app.post("/api/session", async (request, reply) => {
    const body = request.body as { password?: unknown } | undefined;
    const password = typeof body?.password === "string" ? body.password : "";
    if (!cokey.verifyPassword(password)) {
      await reply.code(401).send({ error: { message: "Incorrect password", type: "unauthorized" } });
      return reply;
    }
    const token = sessions.create();
    reply.header(
      "set-cookie",
      `cokey_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`,
    );
    return { authenticated: true, passwordLocked: cokey.passwordLocked() };
  });

  app.delete("/api/session", async (request) => {
    const header = request.headers.cookie;
    const token = header
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("cokey_session="))
      ?.slice("cokey_session=".length);
    sessions.delete(token);
    return { ok: true };
  });
}

/**
 * Serve the built single-page app.
 *
 * Only files under the UI directory are reachable: the resolved path is
 * checked against the root after normalisation, which blocks `../` traversal.
 */
function registerUi(app: FastifyInstance): void {
  const uiDir = resolveUiDirectory();

  app.get("/", async (_request, reply) => {
    const raw = readUiFile("index.html");
    if (!raw) return notBuilt(reply);
    return reply.type(MIME_TYPES[".html"]!).send(raw);
  });

  app.get("/assets/*", async (request, reply) => {
    const relative = (request.params as { "*": string })["*"];
    const file = readUiFile(join("assets", relative), uiDir);
    if (!file) return reply.code(404).send({ error: { message: "Asset not found" } });
    return reply.type(MIME_TYPES[extname(relative)] ?? "application/octet-stream").send(file);
  });

  for (const asset of ["favicon.ico", "favicon.svg", "logo.svg", "vite.svg"]) {
    app.get(`/${asset}`, async (_request, reply) => {
      const file = readUiFile(asset, uiDir);
      if (!file) return reply.code(404).send({ error: { message: "Not found" } });
      return reply.type(MIME_TYPES[extname(asset)] ?? "application/octet-stream").send(file);
    });
  }
}

function readUiFile(relative: string, uiDir = resolveUiDirectory()): Buffer | undefined {
  const target = resolve(uiDir, normalize(relative));
  if (target !== uiDir && !target.startsWith(uiDir + sep)) return undefined;
  if (!existsSync(target)) return undefined;
  try {
    return readFileSync(target);
  } catch {
    return undefined;
  }
}

function notBuilt(reply: FastifyReply): unknown {
  return reply
    .code(503)
    .type("text/html; charset=utf-8")
    .send(
      `<!doctype html><html><body style="font:14px system-ui;background:#0b0d10;color:#e6e8eb;padding:40px">
       <h1>COKEY</h1>
       <p>The web UI has not been built yet. Run <code>npm run build:web</code>, then restart the gateway.</p>
       <p>The API is already available at <code>/v1</code> and <code>/api</code>.</p>
       </body></html>`,
    );
}

export interface StartedServer {
  app: FastifyInstance;
  url: string;
}

/** Create and listen, returning the bound URL. */
export async function startServer(
  cokey: Cokey,
  options: ServerOptions = {},
): Promise<StartedServer> {
  const app = await createServer(cokey, options);
  const settings = cokey.settings;
  await app.listen({ host: settings.host, port: settings.port });
  await app.ready();
  return { app, url: `http://${settings.host}:${settings.port}` };
}