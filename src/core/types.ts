export type CredentialStatus = "healthy" | "cooldown" | "invalid" | "disabled" | "unverified";

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

export function unknownQuota(): QuotaInfo {
  return { available: false, source: "unknown" };
}

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

export interface Credential {
  id: string;
  providerId: string;
  accountId?: string;

  secret: string;

  proxyUrl?: string;

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

export interface CredentialProxyInfo {
  configured: boolean;

  auto: boolean;

  label?: string;
}

export interface CredentialRate {
  requestsPerMinute: number;

  requestsLast5Minutes: number;

  recentlyRateLimited: boolean;

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

  proxy: CredentialProxyInfo;

  rate: CredentialRate;
}

export type RoutingStrategy = "sequential" | "round-robin";

export interface ChainEntry {
  id: string;
  chainId: string;
  providerId: string;
  model: string;

  label?: string;
  baseUrl: string;
  credentialIds: string[];
  enabled: boolean;

  priority: number;
  routingStrategy: RoutingStrategy;
  createdAt: number;
  updatedAt: number;
}

export interface Chain {
  id: string;
  alias: string;
  description?: string;

  entryIds: string[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface LiveRouteSnapshot {
  active: boolean;
  chainAlias?: string;
  providerId?: string;
  model?: string;
  credentialId?: string;
  credentialDescription?: string;
  maskedSecret?: string;
  proxyLabel?: string;

  fallback: boolean;
  attempts: number;
  startedAt?: number;
  updatedAt: number;

  lastOutcome?: "success" | "error";
  lastClassification?: string;

  lastFallbackReason?: string;
}

export interface ChatMessage {
  role: string;
  content: unknown;
  [key: string]: unknown;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}

export interface ProviderError {
  status?: number;
  message: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ValidationResult {
  ok: boolean;
  classification: ErrorClassification;
  message?: string;
  latencyMs?: number;

  models?: ModelInfo[];
}

export interface ModelInfo {
  id: string;
  providerId: string;

  free?: boolean;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

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

  freeProviderTarget: number;

  allowPrivateEndpoints: boolean;

  autoProxy: boolean;
  autoProxyStrategy: AutoProxyStrategy;
  fallback: FallbackPolicy;
}

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
