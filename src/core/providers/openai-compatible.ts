import type { ProviderCatalogEntry } from "../../catalog/types.js";
import { classifyError } from "../errors/classify.js";
import { parseQuota } from "../quota/parse.js";
import type {
  ChainEntry,
  ChatCompletionRequest,
  Credential,
  ErrorClassification,
  ModelInfo,
  ProviderError,
  QuotaInfo,
  ValidationResult,
} from "../types.js";
import type { ProviderAdapter, ProviderRequest, SendResult, TokenUsage } from "./adapter.js";
import { performRequest } from "./http.js";

export class OpenAICompatibleAdapter implements ProviderAdapter {
  readonly id: string;
  readonly apiStyle: string;

  constructor(protected readonly catalog: ProviderCatalogEntry) {
    this.id = catalog.id;
    this.apiStyle = catalog.apiStyle;
  }

  resolveBaseUrl(entry: ChainEntry, _credential: Credential): string {
    return entry.baseUrl.replace(/\/+$/, "");
  }

  buildHeaders(credential: Credential): Record<string, string> {
    const headers: Record<string, string> = {
      "user-agent": "cokey/0.1.0",
      ...this.catalog.extraHeaders,
    };

    switch (this.catalog.authScheme) {
      case "bearer":
        headers["authorization"] = `Bearer ${credential.secret}`;
        break;
      case "x-api-key":
        headers["x-api-key"] = credential.secret;
        break;
      case "query-param":
        break;
      case "custom-header":
        headers["authorization"] = credential.secret;
        break;
    }
    return headers;
  }

  createRequest(
    entry: ChainEntry,
    credential: Credential,
    request: ChatCompletionRequest,
  ): ProviderRequest {
    const base = this.resolveBaseUrl(entry, credential);
    const headers = this.chatHeaders(credential);
    const streaming = request.stream === true;
    const body = JSON.stringify({
      ...request,
      model: entry.model,
      stream: streaming,

      ...(streaming && request.stream_options === undefined
        ? { stream_options: { include_usage: true } }
        : {}),
    });

    return {
      url: this.chatUrl(base, credential),
      method: "POST",
      headers,
      body,
      stream: request.stream === true,

      proxyUrl: credential.proxyUrl,
    };
  }

  async send(
    entry: ChainEntry,
    credential: Credential,
    request: ChatCompletionRequest,
  ): Promise<SendResult> {
    return performRequest(this.createRequest(entry, credential, request));
  }

  classifyError(error: ProviderError): ErrorClassification {
    return classifyError(error);
  }

  parseQuotaResponse(response: Response): QuotaInfo {
    return parseQuota(response.headers);
  }

  extractUsage(body: unknown): TokenUsage {
    return openAiUsage(body);
  }

  async listModels(credential: Credential, options?: { timeoutMs?: number }): Promise<ModelInfo[]> {
    const base = this.modelsUrl(credential);
    const result = await performRequest(
      {
        url: this.withAuthQuery(base, credential),
        method: "GET",
        headers: this.buildHeaders(credential),
        stream: false,
        proxyUrl: credential.proxyUrl,
      },
      { timeoutMs: options?.timeoutMs },
    );

    if (!result.ok) throw new Error(result.error.message);

    const body = (await result.response.json()) as unknown;
    return parseModelList(body, this.id);
  }

  async validateCredential(credential: Credential): Promise<ValidationResult> {
    const started = Date.now();

    if (this.catalog.verification.method === "chat" && this.catalog.verification.model) {
      return this.validateViaChat(credential, this.catalog.verification.model, started);
    }

    if (this.catalog.knownModels.length > 0) {
      const model = await this.pickVerificationModel(credential);
      return this.validateViaChat(credential, model, started);
    }

    return this.validateViaModels(credential, started);
  }

  protected async pickVerificationModel(credential: Credential): Promise<string> {
    const fallback = this.catalog.knownModels[0]!;
    try {
      const live = await this.listModels(credential);
      const liveById = new Map(live.map((entry) => [entry.id, entry]));
      const isFree = (id: string) => liveById.get(id)?.free ?? id.endsWith(":free");
      const stillCurated = this.catalog.knownModels.filter((id) => liveById.has(id));
      const liveIds = live.map((entry) => entry.id);
      return (
        stillCurated.find(isFree) ??
        liveIds.find(isFree) ??
        stillCurated[0] ??
        liveIds[0] ??
        fallback
      );
    } catch {
      return fallback;
    }
  }

  protected async validateViaChat(
    credential: Credential,
    model: string,
    started: number,
  ): Promise<ValidationResult> {
    const base = this.catalog.baseUrl.replace(/\{account_id\}/, credential.accountId ?? "");
    const url = this.chatUrl(base.replace(/\/+$/, ""), credential);

    const result = await performRequest({
      url,
      method: "POST",
      headers: this.chatHeaders(credential),
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      }),
      stream: false,
      proxyUrl: credential.proxyUrl,
    });

    const latencyMs = Date.now() - started;
    if (result.ok) return { ok: true, classification: "success", latencyMs };

    return {
      ok: false,
      classification: this.classifyError(result.error),
      message: result.error.message,
      latencyMs,
    };
  }

  protected async validateViaModels(
    credential: Credential,
    started: number,
  ): Promise<ValidationResult> {
    const result = await performRequest({
      url: this.withAuthQuery(this.modelsUrl(credential), credential),
      method: "GET",
      headers: this.buildHeaders(credential),
      stream: false,
      proxyUrl: credential.proxyUrl,
    });

    const latencyMs = Date.now() - started;
    if (result.ok) {
      const models = await this.safeModels(result.response);
      return { ok: true, classification: "success", latencyMs, models };
    }

    return {
      ok: false,
      classification: this.classifyError(result.error),
      message: result.error.message,
      latencyMs,
    };
  }

  private async safeModels(response: Response): Promise<ModelInfo[] | undefined> {
    try {
      const body = (await response.json()) as unknown;
      return parseModelList(body, this.id);
    } catch {
      return undefined;
    }
  }

  protected chatHeaders(credential: Credential): Record<string, string> {
    return {
      "content-type": "application/json",
      accept: "application/json",
      ...this.buildHeaders(credential),
    };
  }

  protected chatUrl(base: string, credential: Credential): string {
    return this.withAuthQuery(`${base}/chat/completions`, credential);
  }

  protected modelsUrl(credential: Credential): string {
    const base = this.catalog.baseUrl
      .replace(/\{account_id\}/, credential.accountId ?? "")
      .replace(/\/+$/, "");
    return `${base}/models`;
  }

  protected withAuthQuery(url: string, credential: Credential): string {
    if (this.catalog.authScheme !== "query-param") return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}key=${encodeURIComponent(credential.secret)}`;
  }
}

export function openAiUsage(body: unknown): TokenUsage {
  if (!body || typeof body !== "object") return {};
  const usage = (body as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return {};
  const u = usage as Record<string, unknown>;
  const input = num(u.prompt_tokens) ?? num(u.input_tokens);
  const output = num(u.completion_tokens) ?? num(u.output_tokens);
  return { inputTokens: input, outputTokens: output };
}

function isFreeListing(item: Record<string, unknown>): boolean | undefined {
  const tier = item.access_tier;
  if (typeof tier === "string") return tier.toLowerCase() === "free";
  const pricing = item.pricing;
  if (pricing && typeof pricing === "object") {
    const input = num((pricing as { input?: unknown }).input);
    const output = num((pricing as { output?: unknown }).output);
    if (input !== undefined && output !== undefined) return input === 0 && output === 0;
  }
  return undefined;
}

export function parseModelList(body: unknown, providerId: string): ModelInfo[] {
  if (!body || typeof body !== "object") return [];
  const data = (body as { data?: unknown }).data;
  const list = Array.isArray(data) ? data : Array.isArray(body) ? (body as unknown[]) : [];
  const out: ModelInfo[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      out.push({ id: item, providerId });
    } else if (item && typeof item === "object") {
      const id = (item as { id?: unknown }).id ?? (item as { name?: unknown }).name;
      if (typeof id === "string") {
        out.push({ id, providerId, free: isFreeListing(item as Record<string, unknown>) });
      }
    }
  }
  return out;
}

export function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
