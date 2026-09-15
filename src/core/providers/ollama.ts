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
import { performRequest, stripTrailingSlashes } from "./http.js";
import { OpenAICompatibleAdapter, num } from "./openai-compatible.js";
import { iterateLines, sseFrame, SSE_DONE, streamFrom } from "./sse.js";
import { flattenContent, mapFinishReason, openAiChunk, openAiCompletion } from "./transform.js";

export class OllamaAdapter extends OpenAICompatibleAdapter {
  override createRequest(
    entry: ChainEntry,
    credential: Credential,
    request: ChatCompletionRequest,
  ): ProviderRequest {
    const base = stripTrailingSlashes(entry.baseUrl);
    const options: Record<string, unknown> = {};
    const temperature = num(request.temperature);
    if (temperature !== undefined) options.temperature = temperature;
    const topP = num(request.top_p);
    if (topP !== undefined) options.top_p = topP;
    const maxTokens = num(request.max_tokens);
    if (maxTokens !== undefined) options.num_predict = maxTokens;
    if (Array.isArray(request.stop) && request.stop.length > 0) options.stop = request.stop;

    const body: Record<string, unknown> = {
      model: entry.model,
      messages: (request.messages ?? []).map((message) => ({
        role: message.role === "developer" ? "system" : message.role,
        content: flattenContent(message.content),
      })),
      stream: request.stream === true,
    };
    if (Object.keys(options).length > 0) body.options = options;
    if (Array.isArray(request.tools) && request.tools.length > 0) body.tools = request.tools;

    return {
      url: `${base}/api/chat`,
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: request.stream === true ? "application/x-ndjson" : "application/json",
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
    const record = (body ?? {}) as Record<string, unknown>;
    return { inputTokens: num(record.prompt_eval_count), outputTokens: num(record.eval_count) };
  }

  transformResponse(body: unknown, context: TransformContext): unknown {
    const record = (body ?? {}) as Record<string, unknown>;
    const message = (record.message ?? {}) as Record<string, unknown>;
    return openAiCompletion({
      id: context.requestId,
      model: context.model,
      created: context.created,
      content: typeof message.content === "string" ? message.content : "",
      finishReason: mapFinishReason(
        typeof record.done_reason === "string" ? record.done_reason : "stop",
      ),
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
    const base = stripTrailingSlashes(this.catalog.baseUrl);
    const result = await performRequest(
      {
        url: `${base}/api/tags`,
        method: "GET",
        headers: {
          authorization: `Bearer ${credential.secret}`,
          "user-agent": "cokey/0.1.0",
        },
        stream: false,
        proxyUrl: credential.proxyUrl,
      },
      { timeoutMs: options?.timeoutMs },
    );
    if (!result.ok) throw new Error(result.error.message);

    const body = (await result.response.json()) as {
      models?: Array<{ name?: string; model?: string }>;
    };
    return (body.models ?? [])
      .map((m) => m.name ?? m.model)
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

    for await (const line of iterateLines(body)) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(line) as Record<string, unknown>;
      } catch {
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

      const message = (parsed.message ?? {}) as Record<string, unknown>;
      const text = typeof message.content === "string" ? message.content : "";
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

      if (parsed.done === true) {
        yield sseFrame(
          openAiChunk({
            id: context.requestId,
            model: context.model,
            created: context.created,
            delta: {},
            finishReason: mapFinishReason(
              typeof parsed.done_reason === "string" ? parsed.done_reason : "stop",
            ),
            usage: this.extractUsage(parsed),
          }),
        );
      }
    }

    yield SSE_DONE;
  }
}
