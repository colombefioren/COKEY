import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import type { Cokey } from "../core/cokey.js";
import { makeAuthHook } from "./middleware/auth.js";
import { registerManagementRoutes } from "./routes/management.js";
import { registerOpenAiRoutes } from "./routes/openai.js";
import { registerStatsRoutes } from "./routes/stats.js";

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
  // Prefer the built UI (dist/web) which has compiled assets the server can
  // actually serve. The source directory only contains index.html referencing
  // main.tsx, which requires the Vite dev server — not available from tsx.
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
 */
export async function createServer(cokey: Cokey, options: ServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    bodyLimit: 64 * 1024 * 1024,
    disableRequestLogging: true,
  });

  app.addHook("onRequest", makeAuthHook(() => cokey.settings.authToken));

  registerOpenAiRoutes(app, cokey);
  registerManagementRoutes(app, cokey);
  registerStatsRoutes(app, cokey);

  if (options.serveUi !== false) {
    registerUi(app, cokey);
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
        const html = injectAuthToken(raw, cokey.settings.authToken);
        return reply.type(MIME_TYPES[".html"]!).send(html);
      }
    }
    return reply.code(404).send({ error: { message: "Not found", type: "not_found" } });
  });

  return app;
}

/**
 * Serve the built single-page app.
 *
 * When an auth token is configured, it is injected into the HTML as an inline
 * script (`window.COKEY_AUTH_TOKEN`). This lets the UI authenticate its own
 * API calls without a separate login flow. The token is only useful from the
 * same origin — loopback-by-default means this is safe for local use, and on a
 * LAN the attacker would need to already serve the page to read it.
 *
 * Only files under the UI directory are reachable: the resolved path is
 * checked against the root after normalisation, which blocks `../` traversal.
 */
function registerUi(app: FastifyInstance, cokey: Cokey): void {
  const uiDir = resolveUiDirectory();

  app.get("/", async (_request, reply) => {
    const raw = readUiFile("index.html");
    if (!raw) return notBuilt(reply);
    const html = injectAuthToken(raw, cokey.settings.authToken);
    return reply.type(MIME_TYPES[".html"]!).send(html);
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

/**
 * Inject the auth token into the built HTML as an inline script.
 *
 * The token is JSON-stringified (safe in HTML) and only present when configured.
 * When absent, the script sets an empty string so the UI always has a defined value.
 */
function injectAuthToken(html: Buffer, token: string | undefined): Buffer {
  const safe = (token ?? "").replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/"/g, "\\u0022");
  const marker = `<!--__COKEY_AUTH_TOKEN__-->`;
  const injection = `<script>window.COKEY_AUTH_TOKEN="${safe}";</script>`;
  return Buffer.from(String(html).replace(marker, injection));
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
export async function startServer(cokey: Cokey, options: ServerOptions = {}): Promise<StartedServer> {
  const app = await createServer(cokey, options);
  const settings = cokey.settings;
  await app.listen({ host: settings.host, port: settings.port });
  await app.ready();
  return { app, url: `http://${settings.host}:${settings.port}` };
}
