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

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicAdapter extends OpenAICompatibleAdapter {
  override createRequest(
    entry: ChainEntry,
    credential: Credential,
    request: ChatCompletionRequest,
  ): ProviderRequest {
    const base = entry.baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
    const { system, messages } = toAnthropicMessages(request);

    const body: Record<string, unknown> = {
      model: entry.model,
      max_tokens: num(request.max_tokens) ?? DEFAULT_MAX_TOKENS,
      messages,
      stream: request.stream === true,
    };
    if (system) body.system = system;
    if (num(request.temperature) !== undefined) body.temperature = num(request.temperature);
    if (num(request.top_p) !== undefined) body.top_p = num(request.top_p);
    const tools = toAnthropicTools(request.tools);
    if (tools) body.tools = tools;

    return {
      url: `${base}/v1/messages`,
      method: "POST",
      headers: this.headers(
        credential,
        request.stream === true ? "text/event-stream" : "application/json",
      ),
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
    const usage = (body as { usage?: Record<string, unknown> } | undefined)?.usage;
    return {
      inputTokens: num(usage?.input_tokens),
      outputTokens: num(usage?.output_tokens),
    };
  }

  transformResponse(body: unknown, context: TransformContext): unknown {
    const record = (body ?? {}) as Record<string, unknown>;
    const blocks = Array.isArray(record.content) ? record.content : [];

    let text = "";
    const toolCalls: Array<{
      type: "function";
      id: string;
      function: { name?: string; arguments: string };
    }> = [];

    for (const block of blocks) {
      const b = block as Record<string, unknown>;
      if (b.type === "text" && typeof b.text === "string") text += b.text;
      if (b.type === "tool_use") {
        toolCalls.push({
          type: "function",
          id: typeof b.id === "string" ? b.id : `call_${toolCalls.length}`,
          function: {
            name: typeof b.name === "string" ? b.name : undefined,
            arguments: JSON.stringify(b.input ?? {}),
          },
        });
      }
    }

    return openAiCompletion({
      id: context.requestId,
      model: context.model,
      created: context.created,
      content: text,
      finishReason: mapFinishReason(
        typeof record.stop_reason === "string" ? record.stop_reason : undefined,
      ),
      toolCalls,
      usage: this.extractUsage(record),
    });
  }

  transformStream(
    body: ReadableStream<Uint8Array>,
    context: TransformContext,
  ): ReadableStream<Uint8Array> {
    return streamFrom(this.translateStream(body, context));
  }

  override async listModels(
    credential: Credential,
    options?: { timeoutMs?: number },
  ): Promise<ModelInfo[]> {
    const base = this.catalog.baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
    const result = await performRequest(
      {
        url: `${base}/v1/models`,
        method: "GET",
        headers: this.headers(credential, "application/json"),
        stream: false,
        proxyUrl: credential.proxyUrl,
      },
      { timeoutMs: options?.timeoutMs },
    );
    if (!result.ok) throw new Error(result.error.message);

    const body = (await result.response.json()) as { data?: Array<{ id?: string }> };
    return (body.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === "string")
      .map((id) => ({ id, providerId: this.id }));
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

  private headers(credential: Credential, accept: string): Record<string, string> {
    return {
      "content-type": "application/json",
      accept,
      "anthropic-version": ANTHROPIC_VERSION,
      "x-api-key": credential.secret,
      "user-agent": "cokey/0.1.0",
      ...this.catalog.extraHeaders,
    };
  }

  private async *translateStream(
    body: ReadableStream<Uint8Array>,
    context: TransformContext,
  ): AsyncGenerator<string, void, void> {
    let roleSent = false;

    let pendingTool: { id: string; name: string; json: string } | undefined;

    for await (const event of iterateSse(body)) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        continue;
      }

      const type = typeof parsed.type === "string" ? parsed.type : (event.event ?? "");

      if (!roleSent && type !== "message_stop") {
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

      switch (type) {
        case "content_block_start": {
          const block = (parsed.content_block ?? {}) as Record<string, unknown>;
          if (block.type === "tool_use") {
            pendingTool = {
              id: typeof block.id === "string" ? block.id : "call_0",
              name: typeof block.name === "string" ? block.name : "",
              json: "",
            };
          }
          break;
        }

        case "content_block_delta": {
          const delta = (parsed.delta ?? {}) as Record<string, unknown>;
          if (delta.type === "text_delta" && typeof delta.text === "string") {
            yield sseFrame(
              openAiChunk({
                id: context.requestId,
                model: context.model,
                created: context.created,
                delta: { content: delta.text },
              }),
            );
          } else if (delta.type === "input_json_delta" && pendingTool) {
            pendingTool.json += typeof delta.partial_json === "string" ? delta.partial_json : "";
          }
          break;
        }

        case "content_block_stop": {
          if (pendingTool) {
            yield sseFrame(
              openAiChunk({
                id: context.requestId,
                model: context.model,
                created: context.created,
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: pendingTool.id,
                      type: "function",
                      function: { name: pendingTool.name, arguments: pendingTool.json || "{}" },
                    },
                  ],
                },
              }),
            );
            pendingTool = undefined;
          }
          break;
        }

        case "message_delta": {
          const delta = (parsed.delta ?? {}) as Record<string, unknown>;
          const usage = (parsed.usage ?? {}) as Record<string, unknown>;
          yield sseFrame(
            openAiChunk({
              id: context.requestId,
              model: context.model,
              created: context.created,
              delta: {},
              finishReason: mapFinishReason(
                typeof delta.stop_reason === "string" ? delta.stop_reason : undefined,
              ),
              usage: { outputTokens: num(usage.output_tokens) },
            }),
          );
          break;
        }

        default:
          break;
      }
    }

    yield SSE_DONE;
  }
}

export function toAnthropicMessages(request: ChatCompletionRequest): {
  system: string | undefined;
  messages: Array<Record<string, unknown>>;
} {
  const systemParts: string[] = [];
  const messages: Array<Record<string, unknown>> = [];

  for (const message of request.messages ?? []) {
    if (message.role === "system" || message.role === "developer") {
      systemParts.push(flattenContent(message.content));
      continue;
    }

    if (message.role === "tool") {
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id:
              typeof message.tool_call_id === "string" ? message.tool_call_id : "unknown",
            content: flattenContent(message.content),
          },
        ],
      });
      continue;
    }

    if (message.role === "assistant" && Array.isArray(message.tool_calls)) {
      const blocks: Array<Record<string, unknown>> = [];
      const text = flattenContent(message.content);
      if (text) blocks.push({ type: "text", text });
      for (const call of message.tool_calls) {
        const fn = (call as { id?: string; function?: { name?: string; arguments?: string } })
          .function;
        blocks.push({
          type: "tool_use",
          id: (call as { id?: string }).id ?? `call_${blocks.length}`,
          name: fn?.name,
          input: parseArguments(fn?.arguments),
        });
      }
      messages.push({ role: "assistant", content: blocks });
      continue;
    }

    messages.push({
      role: message.role === "assistant" ? "assistant" : "user",
      content: flattenContent(message.content),
    });
  }

  return { system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined, messages };
}

function toAnthropicTools(tools: unknown): unknown[] | undefined {
  if (!Array.isArray(tools) || tools.length === 0) return undefined;
  const out: Array<Record<string, unknown>> = [];
  for (const tool of tools) {
    const fn = (tool as { function?: Record<string, unknown> }).function;
    if (!fn) continue;
    out.push({
      name: fn.name,
      description: fn.description,
      input_schema: fn.parameters ?? { type: "object" },
    });
  }
  return out.length > 0 ? out : undefined;
}

function parseArguments(raw: string | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export { toAnthropicMessages as toAnthropicBody };
