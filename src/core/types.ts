/**
 * Core domain types shared across the COKEY router, storage layer, provider
 * adapters and HTTP API.
 *
 * Nothing in this module performs I/O. It is intentionally dependency-free so
 * that the types can be imported from tests, the CLI and the web build alike.
 */

/** Lifecycle state of a single credential (one API key). */
export type CredentialStatus = "healthy" | "cooldown" | "invalid" | "disabled" | "unverified";

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
  quotaErrors: number;
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
    quotaErrors: 0,
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
  /**
   * Optional per-credential egress proxy (`socks5://`, `socks://`, `http://`).
   *
   * Two keys from one provider only fail over *independently* when they leave
   * through different IPs, so this is part of a credential's identity, not a
   * global setting.
   */
  proxyUrl?: string;
  /**
   * True when the automatic egress pool chose this proxy.
   *
   * The flag is what keeps a pool re-plan from overwriting a proxy the user
   * typed by hand: only pool-owned proxies are ever reassigned.
   */
  proxyAuto?: boolean;
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

/** Proxy configuration of a credential, with credentials stripped. */
export interface CredentialProxyInfo {
  configured: boolean;
  /** True when the pool chose this exit IP rather than the user. */
  auto: boolean;
  /** `host:port` of the proxy. Never includes a proxy username or password. */
  label?: string;
}

/** Locally observed throughput for one credential. */
export interface CredentialRate {
  /** Requests observed in the trailing 60 seconds. */
  requestsPerMinute: number;
  /** Requests observed in the trailing 5 minutes. */
  requestsLast5Minutes: number;
  /** True when the credential hit a provider-side limit within the last 5 min. */
  recentlyRateLimited: boolean;
  /** 12 buckets of 5 seconds covering the last minute, oldest first. */
  sparkline: number[];
  lastRequestAt?: number;
}

export function emptyRate(): CredentialRate {
  return {
    requestsPerMinute: 0,
    requestsLast5Minutes: 0,
    recentlyRateLimited: false,
    sparkline: new Array<number>(12).fill(0),
  };
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
  /** Egress proxy state; never the proxy's own credentials. */
  proxy: CredentialProxyInfo;
  /** Locally measured throughput, which distinguishes keys of one provider. */
  rate: CredentialRate;
}

/** How credentials inside a single chain entry are ordered per request. */
export type RoutingStrategy = "sequential" | "round-robin";

/** One row inside a chain: a provider+model plus the credentials bound to it. */
export interface ChainEntry {
  id: string;
  chainId: string;
  providerId: string;
  model: string;
  /**
   * Optional display name shown to people and clients.
   *
   * Nothing here is derived from the upstream catalogue: a user may call
   * `deepseek-v4-pro` whatever they like, for example "DeepSeek V4 Pro (xKiro)".
   */
  label?: string;
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

/** Route a chat completion goes through right now, for the live status view. */
export interface LiveRouteSnapshot {
  /** True while at least one request is being routed. */
  active: boolean;
  chainAlias?: string;
  providerId?: string;
  model?: string;
  credentialId?: string;
  credentialDescription?: string;
  maskedSecret?: string;
  proxyLabel?: string;
  /** True when the current attempt is not the first entry tried. */
  fallback: boolean;
  attempts: number;
  startedAt?: number;
  updatedAt: number;
  /** Outcome of the most recently finished route. */
  lastOutcome?: "success" | "error";
  lastClassification?: string;
  /** Reason the last route needed fallback, when it did. */
  lastFallbackReason?: string;
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
  /**
   * Whether the listing itself says this model costs nothing to use.
   *
   * Several aggregators (OpenRouter-style ones especially) answer `/models`
   * with an `access_tier` or `pricing` field alongside the id — real signal
   * that a naming convention like a `:free` suffix can silently stop
   * matching once a provider reshuffles its catalog. `undefined` means the
   * listing carried no such field, not that the model is known to cost
   * money.
   */
  free?: boolean;
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
  logLevel: LogLevel;
  dataDir: string;
  showFreeProviderNudger: boolean;
  /** How many connected free providers the nudger aims for. */
  freeProviderTarget: number;
  /** Opt-in escape hatch for the SSRF guard on custom endpoints. */
  allowPrivateEndpoints: boolean;
  /**
   * Spread the egress pool across same-provider keys automatically.
   *
   * When on, every credential of a provider leaves through a different pool
   * entry, which is what makes two keys of one provider genuinely independent
   * instead of sharing the provider's IP-level limit. Keys whose proxy was set
   * by hand are never touched.
   */
  autoProxy: boolean;
  autoProxyStrategy: AutoProxyStrategy;
  fallback: FallbackPolicy;
}

/** How the pool walks its entries when assigning them to providers. */
export type AutoProxyStrategy = "per-provider" | "round-robin";

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
    autoProxy: false,
    autoProxyStrategy: "per-provider",
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
  inputTokens: number;
  outputTokens: number;
}
