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

export interface ProviderRequest {
  url: string;
  method: "POST" | "GET";
  headers: Record<string, string>;
  body?: string;

  stream: boolean;

  proxyUrl?: string;
}

export interface SendSuccess {
  ok: true;
  response: Response;
}

export interface SendFailure {
  ok: false;
  error: ProviderError;
}

export type SendResult = SendSuccess | SendFailure;

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface TransformContext {
  model: string;
  requestId: string;
  created: number;
}

export interface ProviderAdapter {
  readonly id: string;
  readonly apiStyle: string;

  createRequest(
    entry: ChainEntry,
    credential: Credential,
    request: ChatCompletionRequest,
  ): ProviderRequest;

  send(
    entry: ChainEntry,
    credential: Credential,
    request: ChatCompletionRequest,
  ): Promise<SendResult>;

  validateCredential(credential: Credential): Promise<ValidationResult>;

  listModels(credential: Credential, options?: { timeoutMs?: number }): Promise<ModelInfo[]>;

  classifyError(error: ProviderError): ErrorClassification;

  parseQuotaResponse?(response: Response): QuotaInfo;

  extractUsage?(body: unknown): TokenUsage;

  transformResponse?(body: unknown, context: TransformContext): unknown;

  transformStream?(
    body: ReadableStream<Uint8Array>,
    context: TransformContext,
  ): ReadableStream<Uint8Array>;

  resolveBaseUrl(entry: ChainEntry, credential: Credential): string;

  buildHeaders(credential: Credential): Record<string, string>;
}
