/**
 * Core domain types shared across the COKEY router, storage layer, provider
 * adapters and HTTP API.
 *
 * Nothing in this module performs I/O. It is intentionally dependency-free so
 * that the types can be imported from tests, the CLI and the web build alike.
 */

/** Lifecycle state of a single credential (one API key). */
export type CredentialStatus =
  | "healthy"
  | "cooldown"
  | "invalid"
  | "disabled"
  | "unverified";

/**
 * How a failed upstream attempt should influence routing.
 *
 * The router's behaviour is entirely driven by this classification, so every
 * adapter must map provider-specific error payloads onto exactly one of these.
 */
export type ErrorClassification =
  | "success"
  | "credential_rate_limited"
  | "credential_invalid"
  | "quota_exhausted"
  | "temporary_provider_error"
  | "model_unavailable"
  | "context_too_large"
  | "invalid_request"
  | "network_error"
  | "unknown";

/** Rate-limit information reported by a provider, or explicitly unknown. */
export interface QuotaInfo {
  available: boolean;
  requestsRemaining?: number;
  tokensRemaining?: number;
  inputTokensRemaining?: number;
  outputTokensRemaining?: number;
  requestsPerMinute?: number;
  tokensPerMinute?: number;
  resetAt?: number;
  source: "provider" | "estimated" | "unknown";
}

/**
 * The honest "we have no idea" quota value.
 *
 * COKEY never invents quota numbers: when a provider does not expose
 * rate-limit headers, this is what gets stored and displayed.
 */
export function unknownQuota(): QuotaInfo {
  return { available: false, source: "unknown" };
}

/** Locally observed usage counters for a credential. */
export interface UsageStats {
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  rateLimitErrors: number;
  authErrors: number;
  serverErrors: number;
  averageLatencyMs: number;
  lastUsedAt?: number;
  cooldownCount: number;
}

export function emptyUsage(): UsageStats {
  return {
    requests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    rateLimitErrors: 0,
    authErrors: 0,
    serverErrors: 0,
    averageLatencyMs: 0,
    cooldownCount: 0,
  };
}

/** A credential as held in memory. `secret` is decrypted only on demand. */
export interface Credential {
  id: string;
  providerId: string;
  accountId?: string;
  /** Decrypted secret. Never serialised to HTTP responses. */
  secret: string;
  description: string;
  status: CredentialStatus;
  createdAt: number;
  updatedAt: number;
  lastVerifiedAt?: number;
  usage: UsageStats;
  quota?: QuotaInfo;
  cooldownUntil?: number;
  consecutiveFailures: number;
}

/** The only credential shape any HTTP response is allowed to contain. */
export interface PublicCredential {
  id: string;
  providerId: string;
  accountId?: string;
  maskedSecret: string;
  description: string;
  status: CredentialStatus;
  createdAt: number;
  updatedAt: number;
  lastVerifiedAt?: number;
  usage: UsageStats;
  quota?: QuotaInfo;
  cooldownUntil?: number;
  consecutiveFailures: number;
}

/** How credentials inside a single chain entry are ordered per request. */
export type RoutingStrategy = "sequential" | "round-robin";

/** One row inside a chain: a provider+model plus the credentials bound to it. */
export interface ChainEntry {
  id: string;
  chainId: string;
  providerId: string;
  model: string;
  baseUrl: string;
  credentialIds: string[];
  enabled: boolean;
  /** Lower runs first. User-controlled. */
  priority: number;
  routingStrategy: RoutingStrategy;
  createdAt: number;
  updatedAt: number;
}

/** A user-named, ordered list of entries. Its alias is the model clients ask for. */
export interface Chain {
  id: string;
  alias: string;
  description?: string;
  /** Entry ids in display order (already priority-sorted by the manager). */
  entryIds: string[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/** A chat message. Content is passed through verbatim, including multimodal parts. */
export interface ChatMessage {
  role: string;
  content: unknown;
  [key: string]: unknown;
}

/**
 * A chat-completion request. Unknown provider fields are preserved so COKEY can
 * forward tools, response_format, reasoning knobs, and so on untouched.
 */
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}

/** A normalised upstream failure. */
export interface ProviderError {
  status?: number;
  message: string;
  body?: unknown;
  headers?: Record<string, string>;
}

/** Outcome of validating a credential against its provider. */
export interface ValidationResult {
  ok: boolean;
  classification: ErrorClassification;
  message?: string;
  latencyMs?: number;
  /** Models advertised by the provider, when the validation call returned them. */
  models?: ModelInfo[];
}

export interface ModelInfo {
  id: string;
  providerId: string;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

/** User-configurable fallback behaviour, surfaced in Settings and via the API. */
export interface FallbackPolicy {
  enabled: boolean;
  credentialFallback: boolean;
  entryFallback: boolean;
  maxRetriesPerCredential: number;
  cooldownAutomatic: boolean;
}

export interface Settings {
  port: number;
  host: string;
  authToken?: string;
  logLevel: LogLevel;
  dataDir: string;
  showFreeProviderNudger: boolean;
  /** How many connected free providers the nudger aims for. */
  freeProviderTarget: number;
  /** Opt-in escape hatch for the SSRF guard on custom endpoints. */
  allowPrivateEndpoints: boolean;
  fallback: FallbackPolicy;
}

export const DEFAULT_FALLBACK_POLICY: FallbackPolicy = {
  enabled: true,
  credentialFallback: true,
  entryFallback: true,
  maxRetriesPerCredential: 1,
  cooldownAutomatic: true,
};

export function defaultSettings(dataDir: string): Settings {
  return {
    port: 8787,
    host: "127.0.0.1",
    logLevel: "info",
    dataDir,
    showFreeProviderNudger: true,
    freeProviderTarget: 3,
    allowPrivateEndpoints: false,
    fallback: { ...DEFAULT_FALLBACK_POLICY },
  };
}

/** One recorded routing attempt, used for the local request history view. */
export interface RequestLogEntry {
  id: string;
  at: number;
  chainAlias: string;
  entryId: string;
  providerId: string;
  model: string;
  credentialId: string;
  credentialDescription: string;
  latencyMs: number;
  outcome: "success" | "error";
  classification: ErrorClassification;
  fallback: boolean;
  fallbackReason?: string;
  attempts: number;
  stream: boolean;
}
