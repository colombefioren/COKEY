import type { FastifyReply, FastifyRequest, RouteHandlerMethod } from "fastify";
import { ZodError } from "zod";
import { BadCredentialError } from "../../core/cokey.js";
import { ChainNotFoundError as ChainLookupError } from "../../core/chains/manager.js";
import { ChainNotFoundError, ChainDisabledError } from "../../core/router/engine.js";
import { CredentialNotFoundError } from "../../core/credentials/manager.js";
import { DuplicateAliasError, InvalidAliasError } from "../../core/chains/manager.js";
import { InvalidSettingError } from "../../core/settings.js";
import { MiniYamlError } from "../../core/config/mini-yaml.js";

/** Map a thrown error onto a status code. Unknown errors become 500. */
export function statusFor(error: unknown): number {
  if (error instanceof BadCredentialError) return 400;
  if (error instanceof InvalidAliasError) return 400;
  if (error instanceof InvalidSettingError) return 400;
  if (error instanceof MiniYamlError) return 400;
  if (error instanceof ZodError) return 400;
  if (error instanceof DuplicateAliasError) return 409;
  if (error instanceof ChainNotFoundError) return 404;
  if (error instanceof ChainLookupError) return 404;
  if (error instanceof ChainDisabledError) return 409;
  if (error instanceof CredentialNotFoundError) return 404;

  const message = error instanceof Error ? error.message : String(error);
  if (/not found/i.test(message)) return 404;
  if (/already in use/i.test(message)) return 409;
  return 500;
}

export function errorPayload(error: unknown): Record<string, unknown> {
  if (error instanceof ZodError) {
    return {
      error: {
        message: error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; "),
        type: "validation_error",
        issues: error.issues,
      },
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const type =
    error instanceof BadCredentialError
      ? "credential_rejected"
      : error instanceof Error
        ? error.name
        : "error";

  return { error: { message, type } };
}

/**
 * Wrap a route handler so domain errors become well-shaped JSON responses
 * instead of 500s with stack traces.
 */
export function withErrors(
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> | unknown,
): RouteHandlerMethod {
  return async function wrapped(request, reply) {
    try {
      // The returned value IS the response body: Fastify only serialises what
      // an async handler returns, so dropping it would answer 200 with an
      // empty payload.
      return await handler(request, reply);
    } catch (error) {
      const status = statusFor(error);
      if (status >= 500) {
        request.log?.error?.(error);
      }
      const payload = errorPayload(error);
      const body = payload.error as Record<string, unknown>;
      if (error instanceof BadCredentialError) body.classification = error.classification;
      await reply.code(status).send(payload);
      return reply;
    }
  };
}
