import type { FastifyInstance, FastifyReply } from "fastify";
import type { Cokey } from "../../core/cokey.js";
import type { ChatCompletionRequest } from "../../core/types.js";
import {
  AllChainsExhaustedError,
  ChainDisabledError,
  ChainNotFoundError,
  RequestScopedError,
} from "../../core/router/engine.js";
import { ChatCompletionSchema } from "../../core/validation/schemas.js";
import { pipeStream, prependStream } from "../streaming/sse.js";
import {
  COKEY_PROVIDER_NAME,
  chainStateMessage,
  chainStateNotice,
  errorIdentityHeaders,
  identityHeaders,
  withCokeyIdentity,
  withChainStateNotice,
} from "../openai/identity.js";

/**
 * The OpenAI-compatible surface.
 *
 * Clients change one thing - their base URL - and everything else keeps
 * working, including streaming. Fallback decisions are exposed in `X-Cokey-*`
 * response headers so a user can always tell which credential actually served
 * a request.
 */
export function registerOpenAiRoutes(app: FastifyInstance, cokey: Cokey): void {
  /**
   * The model list a client sees.
   *
   * Everything is owned by COKEY, and each entry carries the chain alias as its
   * id, so a picker shows one provider and the user's own chain names instead of
   * whichever vendor happens to sit behind them.
   */
  app.get("/v1/models", async () => {
    const created = Math.floor(Date.now() / 1000);
    const chains = cokey.chains.listChains();

    const data = [
      ...chains.map((chain) => ({
        id: chain.alias,
        object: "model",
        created: Math.floor(chain.createdAt / 1000),
        owned_by: COKEY_PROVIDER_NAME,
        chain: true,
        description: chain.description,
      })),
      ...cokey
        .listModelIds()
        .filter((id) => !chains.some((chain) => chain.alias === id))
        .map((id) => ({ id, object: "model", created, owned_by: COKEY_PROVIDER_NAME })),
    ];

    return { object: "list", data };
  });

  app.post("/v1/chat/completions", async (request, reply) => {
    const parsed = ChatCompletionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          message: parsed.error.issues
            .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
            .join("; "),
          type: "invalid_request_error",
        },
      });
    }

    const body = parsed.data as ChatCompletionRequest;
    const wantsStream = body.stream === true;

    let result;
    try {
      result = await cokey.route(body.model, body);
    } catch (error) {
      return sendRouteError(cokey, reply, error, body.model);
    }

    // Transparency headers. These describe routing, never secrets, and
    // `x-cokey-state` is the plain-language "chain changed state" line a client
    // can surface as an information toast.
    reply.headers(identityHeaders(result));
    cokey.logger.debug("chain state", { state: chainStateMessage(result) });

    const adapter = cokey.providers.get(result.providerId);
    const started = Date.now();
    const upstream = result.response;
    const notice = chainStateNotice(result);

    if (wantsStream) {
      if (!upstream.body) {
        cokey.history.record({
          chainAlias: result.chainAlias,
          entryId: result.entryId,
          providerId: result.providerId,
          model: result.entryModel,
          credentialId: result.credentialId,
          credentialDescription: result.credentialDescription,
          latencyMs: Date.now() - started,
          outcome: "error",
          classification: "unknown",
          fallback: result.fallback,
          fallbackReason: result.fallbackReason,
          attempts: result.attempts.length,
          stream: true,
        });
        reply.hijack();
        reply.raw.writeHead(502, { "content-type": "application/json" });
        reply.raw.end(JSON.stringify({ error: { message: "Upstream returned no stream body" } }));
        return reply;
      }

      // Adapters whose upstream format differs translate the stream; the rest
      // (already OpenAI-compatible) are piped through untouched.
      let stream = adapter.transformStream
        ? adapter.transformStream(upstream.body, result.context)
        : upstream.body;

      // A fallback is visible in the chat itself, not only in headers.
      if (notice) {
        const prefix = new TextEncoder().encode(
          `data: ${JSON.stringify({
            choices: [{ delta: { role: "assistant", content: notice } }],
          })}\n\n`,
        );
        stream = prependStream(prefix, stream);
      }

      cokey.logger.debug("streaming response", {
        chain: result.chainAlias,
        provider: result.providerId,
        fallback: result.fallback,
      });

      await pipeStream(reply, stream, {
        onChunk: () => {
          /* chunk-level hooks reserved for metrics */
        },
      });

      cokey.history.record({
        chainAlias: result.chainAlias,
        entryId: result.entryId,
        providerId: result.providerId,
        model: result.entryModel,
        credentialId: result.credentialId,
        credentialDescription: result.credentialDescription,
        latencyMs: Date.now() - started,
        outcome: "success",
        classification: "success",
        fallback: result.fallback,
        fallbackReason: result.fallbackReason,
        attempts: result.attempts.length,
        stream: true,
      });
      return reply;
    }

    const text = await upstream.text();
    let parsedBody: unknown;
    try {
      parsedBody = text ? JSON.parse(text) : undefined;
    } catch {
      parsedBody = undefined;
    }

    // Token counts only exist in the body, so they are applied here rather
    // than inside the router (which never reads a successful body).
    let inputTokens = 0;
    let outputTokens = 0;
    if (parsedBody !== undefined) {
      const usage = adapter.extractUsage?.(parsedBody);
      if (usage && (usage.inputTokens || usage.outputTokens)) {
        cokey.credentials.recordTokens(result.credentialId, usage);
        inputTokens = usage.inputTokens ?? 0;
        outputTokens = usage.outputTokens ?? 0;
      }
    }

    cokey.history.record({
      chainAlias: result.chainAlias,
      entryId: result.entryId,
      providerId: result.providerId,
      model: result.entryModel,
      credentialId: result.credentialId,
      credentialDescription: result.credentialDescription,
      latencyMs: Date.now() - started,
      outcome: upstream.ok ? "success" : "error",
      classification: upstream.ok ? "success" : "unknown",
      fallback: result.fallback,
      fallbackReason: result.fallbackReason,
      attempts: result.attempts.length,
      stream: false,
      inputTokens,
      outputTokens,
    });

    const contentType = upstream.headers.get("content-type") ?? "application/json";

    if (parsedBody !== undefined && adapter.transformResponse) {
      const transformed = adapter.transformResponse(parsedBody, result.context);
      return reply
        .code(upstream.status)
        .type("application/json")
        .send(withCokeyIdentity(withChainStateNotice(transformed, notice), result.chainAlias));
    }

    if (parsedBody !== undefined) {
      // The upstream model id is replaced by the chain alias so a chat window
      // shows the user's own chain name. The vendor is still in X-Cokey-Entry.
      return reply
        .code(upstream.status)
        .type(contentType)
        .send(withCokeyIdentity(withChainStateNotice(parsedBody, notice), result.chainAlias));
    }

    return reply
      .code(upstream.status)
      .type(contentType)
      .send(notice ? `${notice}\n${text}` : text);
  });
}

function sendRouteError(cokey: Cokey, reply: FastifyReply, error: unknown, requestedModel: string) {
  if (error instanceof RequestScopedError) {
    const last = error.attempts[error.attempts.length - 1];
    const origin = "provider";
    const headers = errorIdentityHeaders({
      attempts: error.attempts,
      chainAlias: last?.chainAlias,
      fallback: error.attempts.length > 0,
    });
    return reply
      .code(error.providerError.status ?? 400)
      .headers(headers)
      .send({
        error: {
          message: last
            ? `${last.providerId}/${last.model}: ${error.providerError.message}`
            : error.providerError.message,
          type: error.classification,
          origin,
          attempts: error.attempts,
          status: error.providerError.status,
        },
      });
  }

  if (error instanceof AllChainsExhaustedError) {
    cokey.history.record({
      chainAlias: requestedModel,
      entryId: "-",
      providerId: "-",
      model: requestedModel,
      credentialId: "-",
      credentialDescription: "-",
      latencyMs: 0,
      outcome: "error",
      classification: "unknown",
      fallback: true,
      fallbackReason: "all_chains_exhausted",
      attempts: error.attempts.length,
      stream: false,
    });

    const info = {
      attempts: error.attempts,
      chainAlias: error.routeInfo?.chainAlias ?? requestedModel,
      fallback: error.routeInfo?.fallback ?? error.attempts.length > 0,
      fallbackReason: error.routeInfo?.fallbackReason,
    };
    const origin = info.attempts.length > 0 ? "provider" : "gateway";
    const last = info.attempts[info.attempts.length - 1];
    const providers = [...new Set(info.attempts.map((a) => a.providerId))].join(", ");
    return reply
      .code(502)
      .headers(errorIdentityHeaders(info))
      .send({
        error: {
          message: info.attempts.length
            ? `All chains exhausted: ${providers} did not answer OK`
            : "All chains exhausted",
          type: "all_chains_exhausted",
          origin,
          ...(last?.providerId ? { provider: last.providerId } : {}),
          attempts: info.attempts,
          ...(info.fallbackReason ? { fallbackReason: info.fallbackReason } : {}),
        },
      });
  }

  if (error instanceof ChainNotFoundError || error instanceof ChainDisabledError) {
    return reply
      .code(404)
      .headers(errorIdentityHeaders({ attempts: [], chainAlias: requestedModel }))
      .send({
        error: {
          message: (error as Error).message,
          type: "chain_unavailable",
          origin: "gateway",
        },
      });
  }

  return reply
    .code(500)
    .headers(errorIdentityHeaders({ attempts: [], chainAlias: requestedModel }))
    .send({
      error: {
        message: (error as Error).message,
        type: "internal_error",
        origin: "gateway",
      },
    });
}
