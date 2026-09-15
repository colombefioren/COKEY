import type { FastifyReply, FastifyRequest, onRequestHookHandler } from "fastify";
import type { SessionStore } from "../session.js";

declare module "fastify" {
  interface FastifyContextConfig {
    public?: boolean;
  }
}

const SESSION_COOKIE = "cokey_session";

export interface AuthDependencies {
  sessions: SessionStore;

  verifyApiKey: (presented: string) => { name: string } | undefined;
  verifyPassword: (password: string) => boolean;
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
    if (request.routeOptions?.config?.public === true) return;

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
