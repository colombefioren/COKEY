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

/** A fully-resolved HTTP request for an upstream provider. */
export interface ProviderRequest {
  url: string;
  method: "POST" | "GET";
  headers: Record<string, string>;
  body?: string;
  /** True when the client asked for a streamed response. */
  stream: boolean;
  /**
   * Egress proxy for this request, taken from the credential.
   *
   * Adapters set it from `credential.proxyUrl` so every call made on behalf of
   * a key leaves through that key's own exit IP.
   */
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

/**
 * Identity of the completion currently being translated.
 *
 * Upstreams that do not echo the user-visible model name need it from the
 * chain entry, and reusing one stable id keeps a translated stream consistent
 * across its chunks.
 */
export interface TransformContext {
  model: string;
  requestId: string;
  created: number;
}

/**
 * The contract every provider integration implements.
 *
 * Nearly all catalog entries are served by {@link OpenAICompatibleAdapter}; a
 * dedicated adapter only exists where the wire format genuinely differs.
 *
 * Translation is the adapter's job: COKEY's own contract is OpenAI-compatible,
 * so adapters whose upstream is not (`google`, `cohere`, `ollama`, `anthropic`)
 * translate both the request and the response, including streamed chunks.
 */
export interface ProviderAdapter {
  readonly id: string;
  readonly apiStyle: string;

  /** Build the upstream request for a chat completion. */
  createRequest(
    entry: ChainEntry,
    credential: Credential,
    request: ChatCompletionRequest,
  ): ProviderRequest;

  /** Execute a chat completion. */
  send(
    entry: ChainEntry,
    credential: Credential,
    request: ChatCompletionRequest,
  ): Promise<SendResult>;

  /** Prove a credential works before it is allowed into a chain. */
  validateCredential(credential: Credential): Promise<ValidationResult>;

  /** Cheap model listing, when the provider supports it. */
  listModels(credential: Credential): Promise<ModelInfo[]>;

  /** Map an upstream failure onto a routing decision. */
  classifyError(error: ProviderError): ErrorClassification;

  /** Read quota information out of a successful response, if any. */
  parseQuotaResponse?(response: Response): QuotaInfo;

  /** Extract token usage from a non-streamed response body. */
  extractUsage?(body: unknown): TokenUsage;

  /**
   * Translate a non-streamed upstream body into OpenAI chat-completion shape.
   * Absent means "already OpenAI-compatible, forward verbatim".
   */
  transformResponse?(body: unknown, context: TransformContext): unknown;

  /**
   * Translate an upstream byte stream into OpenAI `text/event-stream` framing.
   * Absent means "already SSE, pipe verbatim".
   */
  transformStream?(
    body: ReadableStream<Uint8Array>,
    context: TransformContext,
  ): ReadableStream<Uint8Array>;

  /** Resolve the base URL for an entry, expanding templated segments. */
  resolveBaseUrl(entry: ChainEntry, credential: Credential): string;

  /** Build auth headers for a credential. */
  buildHeaders(credential: Credential): Record<string, string>;
}
