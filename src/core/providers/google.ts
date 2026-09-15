import { classifyError } from "../errors/classify.js";
import type {
  ChatCompletionRequest,
  ChatMessage,
  Credential,
  ErrorClassification,
  ModelInfo,
  ProviderError,
  ValidationResult,
} from "../types.js";
import type { ChainEntry } from "../types.js";
import type { ProviderRequest, SendResult, TokenUsage, TransformContext } from "./adapter.js";
import { performRequest } from "./http.js";
import { OpenAICompatibleAdapter, num } from "./openai-compatible.js";
import { iterateSse, sseFrame, SSE_DONE, streamFrom } from "./sse.js";
import { flattenContent, mapFinishReason, openAiChunk, openAiCompletion } from "./transform.js";

export class GoogleAdapter extends OpenAICompatibleAdapter {
  override createRequest(
    entry: ChainEntry,
    credential: Credential,
    request: ChatCompletionRequest,
  ): ProviderRequest {
    const base = entry.baseUrl.replace(/\/+$/, "");
    const model = normalizeGeminiModel(entry.model);
    const stream = request.stream === true;
    const method = stream ? "streamGenerateContent" : "generateContent";
    const query = `key=${encodeURIComponent(credential.secret)}${stream ? "&alt=sse" : ""}`;

    return {
      url: `${base}/${model}:${method}?${query}`,
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "cokey/0.1.0" },
      body: JSON.stringify(toGeminiRequest(request)),
      stream,
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
    const metadata = (body as { usageMetadata?: Record<string, unknown> } | undefined)
      ?.usageMetadata;
    return {
      inputTokens: num(metadata?.promptTokenCount),
      outputTokens: num(metadata?.candidatesTokenCount),
    };
  }

  transformResponse(body: unknown, context: TransformContext): unknown {
    return geminiToOpenAi(body, context);
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
    const base = this.catalog.baseUrl.replace(/\/+$/, "");
    const result = await performRequest(
      {
        url: `${base}/models?key=${encodeURIComponent(credential.secret)}`,
        method: "GET",
        headers: { "user-agent": "cokey/0.1.0" },
        stream: false,
        proxyUrl: credential.proxyUrl,
      },
      { timeoutMs: options?.timeoutMs },
    );
    if (!result.ok) throw new Error(result.error.message);
    const body = (await result.response.json()) as { models?: Array<{ name?: string }> };
    return (body.models ?? [])
      .map((m) => m.name)
      .filter((name): name is string => typeof name === "string")
      .map((name) => ({ id: name.replace(/^models\//, ""), providerId: this.id }));
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

      const candidate = firstCandidate(parsed);
      const { text, toolCalls } = readGeminiParts(candidate);

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

      for (const call of toolCalls) {
        yield sseFrame(
          openAiChunk({
            id: context.requestId,
            model: context.model,
            created: context.created,
            delta: { tool_calls: [call] },
          }),
        );
      }

      if (text) {
        yield sseFrame(
          openAiChunk({
            id: context.requestId,
            model: context.model,
            created: context.created,
            delta: { content: text },
          }),
        );
      }

      const finishReason = finishReasonOf(candidate);
      if (finishReason) {
        yield sseFrame(
          openAiChunk({
            id: context.requestId,
            model: context.model,
            created: context.created,
            delta: {},
            finishReason: mapFinishReason(finishReason),
            usage: this.extractUsage(parsed),
          }),
        );
      }
    }

    yield SSE_DONE;
  }
}

export function normalizeGeminiModel(model: string): string {
  return model.startsWith("models/") ? model : `models/${model}`;
}

function toGeminiRequest(request: ChatCompletionRequest): Record<string, unknown> {
  const contents: Array<Record<string, unknown>> = [];
  const systemParts: Array<Record<string, unknown>> = [];

  for (const message of request.messages ?? []) {
    if (message.role === "system" || message.role === "developer") {
      systemParts.push({ text: flattenContent(message.content) });
      continue;
    }

    if (message.role === "tool") {
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: typeof message.name === "string" ? message.name : "tool",
              response: { content: flattenContent(message.content) },
            },
          },
        ],
      });
      continue;
    }

    const parts: Array<Record<string, unknown>> = [];
    const text = flattenContent(message.content);
    if (text) parts.push({ text });

    const toolCalls = message.tool_calls;
    if (Array.isArray(toolCalls)) {
      for (const call of toolCalls) {
        const fn = (call as { function?: { name?: string; arguments?: string } }).function;
        parts.push({
          functionCall: { name: fn?.name, args: parseArguments(fn?.arguments) },
        });
      }
    }

    contents.push({ role: message.role === "assistant" ? "model" : "user", parts });
  }

  const body: Record<string, unknown> = { contents };
  if (systemParts.length > 0) body.systemInstruction = { parts: systemParts };

  const generationConfig: Record<string, unknown> = {};
  const maxTokens = num(request.max_tokens) ?? num(request.max_completion_tokens);
  if (maxTokens !== undefined) generationConfig.maxOutputTokens = maxTokens;
  if (num(request.temperature) !== undefined)
    generationConfig.temperature = num(request.temperature);
  if (num(request.top_p) !== undefined) generationConfig.topP = num(request.top_p);
  if (Array.isArray(request.stop) && request.stop.length > 0)
    generationConfig.stopSequences = request.stop;
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

  const tools = toGeminiTools(request.tools);
  if (tools) body.tools = tools;

  return body;
}

function toGeminiTools(tools: unknown): unknown[] | undefined {
  if (!Array.isArray(tools) || tools.length === 0) return undefined;
  const declarations: Array<Record<string, unknown>> = [];
  for (const tool of tools) {
    const fn = (tool as { function?: Record<string, unknown> }).function;
    if (!fn) continue;
    declarations.push({
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters,
    });
  }
  if (declarations.length === 0) return undefined;
  return [{ functionDeclarations: declarations }];
}

function parseArguments(raw: string | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function firstCandidate(body: Record<string, unknown>): Record<string, unknown> | undefined {
  const candidates = body.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return undefined;
  return candidates[0] as Record<string, unknown>;
}

function finishReasonOf(candidate: Record<string, unknown> | undefined): string | undefined {
  const reason = candidate?.finishReason;
  return typeof reason === "string" ? reason : undefined;
}

function readGeminiParts(candidate: Record<string, unknown> | undefined): {
  text: string;
  toolCalls: Array<Record<string, unknown>>;
} {
  const content = candidate?.content as { parts?: unknown[] } | undefined;
  const parts = Array.isArray(content?.parts) ? content.parts : [];

  let text = "";
  const toolCalls: Array<Record<string, unknown>> = [];

  for (const part of parts) {
    const p = part as Record<string, unknown>;
    if (typeof p.text === "string") text += p.text;
    const call = p.functionCall as { name?: string; args?: unknown } | undefined;
    if (call) {
      toolCalls.push({
        index: toolCalls.length,
        id: `call_${call.name ?? "tool"}_${toolCalls.length}`,
        type: "function",
        function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) },
      });
    }
  }
  return { text, toolCalls };
}

function geminiToOpenAi(body: unknown, context: TransformContext): unknown {
  const record = (body ?? {}) as Record<string, unknown>;
  const candidate = firstCandidate(record);
  const { text, toolCalls } = readGeminiParts(candidate);

  const metadata = record.usageMetadata as Record<string, unknown> | undefined;
  return openAiCompletion({
    id: context.requestId,
    model: context.model,
    created: context.created,
    content: text,
    finishReason: mapFinishReason(finishReasonOf(candidate)),
    toolCalls: toolCalls.map((call) => ({
      type: "function" as const,
      id: String(call.id),
      function: {
        name: String((call.function as { name?: string }).name ?? ""),
        arguments: String((call.function as { arguments?: string }).arguments ?? "{}"),
      },
    })),
    usage: {
      inputTokens: num(metadata?.promptTokenCount),
      outputTokens: num(metadata?.candidatesTokenCount),
    },
  });
}

export { toGeminiRequest };

export type { ChatMessage };
