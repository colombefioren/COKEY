import type { FastifyReply, FastifyRequest, onRequestHookHandler } from "fastify";

/** Paths that never require the local auth token. */
const PUBLIC_PREFIXES = ["/", "/health", "/assets", "/favicon.ico"];

function isPublic(url: string): boolean {
  if (url === "/" || url === "/health") return true;
  if (url.startsWith("/assets/")) return true;
  if (url === "/favicon.ico" || url === "/logo.svg") return true;
  // The single-page UI is public; the API it calls is not.
  return PUBLIC_PREFIXES.includes(url) && !url.startsWith("/api") && !url.startsWith("/v1");
}

/**
 * Optional local auth token.
 *
 * COKEY binds to loopback by default, so this is opt-in hardening for users who
 * expose the port to a LAN. When no token is configured, every request is
 * allowed — otherwise the gateway would be unusable out of the box.
 */
export function makeAuthHook(expectedToken?: string): onRequestHookHandler {
  return async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!expectedToken) return;
    if (isPublic(request.url)) return;

    const header = request.headers.authorization;
    const token =
      typeof header === "string" && header.toLowerCase().startsWith("bearer ")
        ? header.slice(7).trim()
        : undefined;

    if (token !== expectedToken) {
      await reply.code(401).send({
        error: { message: "Unauthorized", type: "unauthorized" },
      });
    }
  };
}
