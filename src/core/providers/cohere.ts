import { classifyError } from "../errors/classify.js";
import type {
  ChainEntry,
  ChatCompletionRequest,
  Credential,
  ErrorClassification,
  ModelInfo,
  ProviderError,
  ValidationResult,
} from "../types.js";
import type { ProviderRequest, SendResult, TokenUsage, TransformContext } from "./adapter.js";
import { performRequest } from "./http.js";
import { OpenAICompatibleAdapter, num } from "./openai-compatible.js";
import { iterateSse, sseFrame, SSE_DONE, streamFrom } from "./sse.js";
import { flattenContent, mapFinishReason, openAiChunk, openAiCompletion } from "./transform.js";

/**
 * Cohere v2 (`/chat`) adapter.
 *
 * v2 is close to OpenAI in spirit but differs in field names (`message.content`
 * is an array of typed blocks, usage nests under `tokens`) and in its streamed
 * event vocabulary (`content-delta`, `message-end`, …).
 */
export class CohereAdapter extends OpenAICompatibleAdapter {
  override createRequest(
    entry: ChainEntry,
    credential: Credential,
    request: ChatCompletionRequest,
  ): ProviderRequest {
    const base = entry.baseUrl.replace(/\/+$/, "");
    const body: Record<string, unknown> = {
      model: entry.model,
      messages: (request.messages ?? []).map((message) => ({
        role: message.role === "developer" ? "system" : message.role,
        content: flattenContent(message.content),
      })),
      stream: request.stream === true,
    };

    if (num(request.temperature) !== undefined) body.temperature = num(request.temperature);
    if (num(request.max_tokens) !== undefined) body.max_tokens = num(request.max_tokens);
    if (Array.isArray(request.stop) && request.stop.length > 0) body.stop_sequences = request.stop;
    if (Array.isArray(request.tools) && request.tools.length > 0) body.tools = request.tools;

    return {
      url: `${base}/chat`,
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: request.stream === true ? "text/event-stream" : "application/json",
        "user-agent": "cokey/0.1.0",
        authorization: `Bearer ${credential.secret}`,
      },
      body: JSON.stringify(body),
      stream: request.stream === true,
      proxyUrl: credential.proxyUrl,
    };
  }

  override async send(
    entry: ChainEntry,
    credential: Credential,
    request: ChatCompletionRequest,
  ): Promise<SendResult> {
    return performRequest(this.createRequest(entry, credential, request));
  }

  override classifyError(error: ProviderError): ErrorClassification {
    return classifyError(error);
  }

  override extractUsage(body: unknown): TokenUsage {
    const usage = (body as { usage?: { tokens?: Record<string, unknown> } } | undefined)?.usage;
    return {
      inputTokens: num(usage?.tokens?.input_tokens),
      outputTokens: num(usage?.tokens?.output_tokens),
    };
  }

  transformResponse(body: unknown, context: TransformContext): unknown {
    const record = (body ?? {}) as Record<string, unknown>;
    const message = (record.message ?? {}) as Record<string, unknown>;
    return openAiCompletion({
      id: context.requestId,
      model: context.model,
      created: context.created,
      content: readCohereText(message),
      finishReason: mapFinishReason(
        typeof record.finish_reason === "string" ? record.finish_reason : undefined,
      ),
      toolCalls: readCohereToolCalls(message),
      usage: this.extractUsage(record),
    });
  }

  transformStream(
    body: ReadableStream<Uint8Array>,
    context: TransformContext,
  ): ReadableStream<Uint8Array> {
    return streamFrom(this.translateStream(body, context));
  }

  override async listModels(credential: Credential): Promise<ModelInfo[]> {
    const base = this.catalog.baseUrl.replace(/\/+$/, "");
    const result = await performRequest({
      url: `${base}/models`,
      method: "GET",
      headers: {
        authorization: `Bearer ${credential.secret}`,
        "user-agent": "cokey/0.1.0",
      },
      stream: false,
      proxyUrl: credential.proxyUrl,
    });
    if (!result.ok) throw new Error(result.error.message);

    const body = (await result.response.json()) as { models?: Array<{ name?: string }> };
    return (body.models ?? [])
      .map((m) => m.name)
      .filter((name): name is string => typeof name === "string")
      .map((name) => ({ id: name, providerId: this.id }));
  }

  override async validateCredential(credential: Credential): Promise<ValidationResult> {
    const started = Date.now();
    try {
      const models = await this.listModels(credential);
      return { ok: true, classification: "success", latencyMs: Date.now() - started, models };
    } catch (error) {
      return {
        ok: false,
        classification: "credential_invalid",
        message: (error as Error).message,
        latencyMs: Date.now() - started,
      };
    }
  }

  private async *translateStream(
    body: ReadableStream<Uint8Array>,
    context: TransformContext,
  ): AsyncGenerator<string, void, void> {
    let roleSent = false;

    for await (const event of iterateSse(body)) {
      if (event.data === "[DONE]") break;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        continue;
      }

      const type = typeof parsed.type === "string" ? parsed.type : "";

      if (type === "message-start") {
        yield sseFrame(
          openAiChunk({
            id: context.requestId,
            model: context.model,
            created: context.created,
            delta: { role: "assistant", content: "" },
          }),
        );
        roleSent = true;
        continue;
      }

      if (!roleSent) {
        yield sseFrame(
          openAiChunk({
            id: context.requestId,
            model: context.model,
            created: context.created,
            delta: { role: "assistant", content: "" },
          }),
        );
        roleSent = true;
      }

      if (type === "content-delta") {
        const delta = parsed.delta as Record<string, unknown> | undefined;
        const message = delta?.message as Record<string, unknown> | undefined;
        const content = message?.content as Record<string, unknown> | undefined;
        const text = content?.text;
        if (typeof text === "string" && text.length > 0) {
          yield sseFrame(
            openAiChunk({
              id: context.requestId,
              model: context.model,
              created: context.created,
              delta: { content: text },
            }),
          );
        }
        continue;
      }

      if (type === "message-end") {
        const delta = parsed.delta as Record<string, unknown> | undefined;
        const usage = delta?.usage as { tokens?: Record<string, unknown> } | undefined;
        yield sseFrame(
          openAiChunk({
            id: context.requestId,
            model: context.model,
            created: context.created,
            delta: {},
            finishReason: mapFinishReason(
              typeof delta?.finish_reason === "string" ? delta.finish_reason : undefined,
            ),
            usage: {
              inputTokens: num(usage?.tokens?.input_tokens),
              outputTokens: num(usage?.tokens?.output_tokens),
            },
          }),
        );
      }
    }

    yield SSE_DONE;
  }
}

function readCohereText(message: Record<string, unknown>): string {
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      const b = block as Record<string, unknown>;
      return typeof b.text === "string" ? b.text : "";
    })
    .join("");
}

function readCohereToolCalls(message: Record<string, unknown>): Array<{
  type: "function";
  id: string;
  function: { name?: string; arguments: string };
}> {
  const calls = message.tool_calls;
  if (!Array.isArray(calls)) return [];
  return calls.map((call, index) => {
    const c = call as { id?: string; function?: { name?: string; arguments?: string } };
    return {
      type: "function" as const,
      id: c.id ?? `call_${index}`,
      function: { name: c.function?.name, arguments: c.function?.arguments ?? "{}" },
    };
  });
}
