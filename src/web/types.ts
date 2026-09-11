/**
 * View types for the management API.
 *
 * These mirror the server's response shapes. They are declared here rather
 * than imported from the server tree so the browser bundle stays free of any
 * Node-only module graph.
 */

export type CredentialStatus = "healthy" | "cooldown" | "invalid" | "disabled" | "unverified";

export interface QuotaInfo {
  available: boolean;
  requestsRemaining?: number;
  tokensRemaining?: number;
  requestsPerMinute?: number;
  tokensPerMinute?: number;
  resetAt?: number;
  source: "provider" | "estimated" | "unknown";
}

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

export interface ChainEntryView {
  id: string;
  chainId: string;
  providerId: string;
  model: string;
  baseUrl: string;
  credentialIds: string[];
  enabled: boolean;
  priority: number;
  routingStrategy: "sequential" | "round-robin";
  createdAt: number;
  updatedAt: number;
  credentials: PublicCredential[];
  healthyCount: number;
  cooldownCount: number;
  provider?: ProviderCatalogEntry;
}

export interface ChainView {
  id: string;
  alias: string;
  description?: string;
  entryIds: string[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  entries: ChainEntryView[];
}

export interface ProviderCatalogEntry {
  id: string;
  displayName: string;
  baseUrl: string;
  apiStyle: string;
  authScheme: string;
  signupUrl: string;
  docsUrl?: string;
  freeTier: { advertised: boolean; summary: string; quotaSource: string };
  knownModels: string[];
  credentialFields: Array<"secret" | "accountId">;
  verification: { method: "chat" | "models"; model?: string };
  notes?: string;
}

export interface ProviderStatus extends ProviderCatalogEntry {
  connected: boolean;
  credentialCount: number;
  healthyCount: number;
}

export interface ValidationResult {
  ok: boolean;
  classification: string;
  message?: string;
  latencyMs?: number;
}

export interface HistoryStats {
  total: number;
  success: number;
  failure: number;
  fallbackCount: number;
  averageLatencyMs: number;
  byClassification: Record<string, number>;
}

export interface Stats {
  chains: number;
  credentials: number;
  healthyCredentials: number;
  cooldownCredentials: number;
  invalidCredentials: number;
  providersConnected: number;
  customEndpoints: number;
  history: HistoryStats;
  dataDir: string;
  keySource: string;
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
  classification: string;
  fallback: boolean;
  fallbackReason?: string;
  attempts: number;
  stream: boolean;
}

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
  logLevel: "debug" | "info" | "warn" | "error";
  dataDir: string;
  showFreeProviderNudger: boolean;
  freeProviderTarget: number;
  allowPrivateEndpoints: boolean;
  fallback: FallbackPolicy;
  authTokenConfigured: boolean;
}

export interface Nudge {
  enabled: boolean;
  connectedFree: number;
  target: number;
  suggestions: Array<{ id: string; displayName: string; summary: string; signupUrl: string }>;
}

export interface ConnectResult {
  credential: PublicCredential;
  validation: ValidationResult;
}
