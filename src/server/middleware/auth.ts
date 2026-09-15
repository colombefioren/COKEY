import type { FastifyReply, FastifyRequest, onRequestHookHandler } from "fastify";
import type { SessionStore } from "../session.js";

const SESSION_COOKIE = "cokey_session";

export interface AuthDependencies {
  sessions: SessionStore;

  verifyApiKey: (presented: string) => { name: string } | undefined;
  verifyPassword: (password: string) => boolean;
}

function isPublic(url: string): boolean {
  if (url === "/" || url === "/health") return true;
  if (url.startsWith("/assets/")) return true;
  if (url === "/favicon.ico" || url === "/logo.svg" || url === "/favicon.svg") return true;
  if (url === "/api/session" || url.startsWith("/api/session/")) return true;
  return false;
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (typeof header !== "string" || !header.toLowerCase().startsWith("bearer ")) return undefined;
  const value = header.slice(7).trim();
  return value || undefined;
}

export function makeAuthHook(deps: AuthDependencies): onRequestHookHandler {
  return async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (isPublic(request.url)) return;

    const cookieSession = readCookie(request.headers.cookie, SESSION_COOKIE);
    if (deps.sessions.has(cookieSession)) return;

    const presented = bearerToken(request);
    if (presented) {
      if (deps.verifyApiKey(presented)) return;
      if (deps.verifyPassword(presented)) return;
    }

    await reply.code(401).send({
      error: { message: "Unauthorized", type: "unauthorized" },
    });
  };
}

export { SESSION_COOKIE };
