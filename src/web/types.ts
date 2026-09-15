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
  quotaErrors: number;
  authErrors: number;
  serverErrors: number;
  averageLatencyMs: number;
  lastUsedAt?: number;
  cooldownCount: number;
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

export interface ChainEntryView {
  id: string;
  chainId: string;
  providerId: string;
  model: string;

  label?: string;
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

  autoProxy: boolean;
  autoProxyStrategy: AutoProxyStrategy;
  proxyPoolSize: number;
  fallback: FallbackPolicy;
  passwordLocked: boolean;
}

export type AutoProxyStrategy = "per-provider" | "round-robin";

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PageParams {
  page?: number;
  pageSize?: number;
  q?: string;
}

export interface ProxyPoolEntryView {
  id: string;

  label: string;
  enabled: boolean;
  createdAt: number;
  assignedTo: number;
}

export interface ProxyPoolStatus {
  enabled: boolean;
  size: number;
  enabledCount: number;
  providerCount: number;
  assignments: number;

  saturatedProviders: string[];
  strategy: AutoProxyStrategy;
}

export interface ProxyPoolResponse {
  entries: ProxyPoolEntryView[];
  status: ProxyPoolStatus;
}

export interface ProxyPoolBulkResponse extends ProxyPoolResponse {
  added: number;
  skipped: number;

  checked?: number;
  alive?: number;
  dead?: number;
}

export interface ProxyPoolCheckResponse extends ProxyPoolResponse {
  checked: number;
  healthy: number;
  dead: string[];
  removed: number;
}

export interface ModelProbeResult {
  ok: boolean;
  providerId: string;
  model: string;
  credentialId?: string;
  credentialDescription?: string;
  status?: number;
  latencyMs: number;
  classification: string;
  message?: string;
  reply?: string;
  proxyLabel?: string;
}

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  createdAt: number;
  lastUsedAt?: number;
  enabled: boolean;
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

  models?: ModelDiscoveryReport;
}

export interface ModelDiscoveryReport {
  added: string[];
  restored: string[];
  removed: string[];

  pruned: number;

  stale: string[];

  uncurated: string[];

  unchanged: number;
  providerId: string;
  displayName: string;
  ok: boolean;

  message?: string;
  latencyMs: number;
  checkedAt: number;

  discovered: number;

  tracked: number;
}

export interface ProviderModelRecordView {
  providerId: string;
  model: string;

  curated: boolean;

  available: boolean;
  firstSeen: number;
  lastSeen: number;
  lastChecked: number;
}

export interface ProviderModelInventory {
  providerId: string;
  displayName: string;

  checkedAt?: number;
  models: ProviderModelRecordView[];
}

export type GuidanceSeverity = "info" | "warn" | "critical";

export type GuidanceKind =
  | "credential.rejected"
  | "credential.struggling"
  | "credential.never-verified"
  | "provider.all-keys-unusable"
  | "provider.models-stale"
  | "provider.models-never-checked"
  | "provider.models-outdated"
  | "chain.model-retired"
  | "chain.node-unkeyed"
  | "chain.node-unhealthy"
  | "chain.none"
  | "egress.saturated"
  | "coverage.free-providers";

export type GuidanceAction =
  | { kind: "navigate"; label: string; path: string }
  | { kind: "refresh-models"; label: string; providerId: string }
  | { kind: "reverify-credential"; label: string; credentialId: string };

export interface GuidanceNotice {
  id: string;
  kind: GuidanceKind;
  severity: GuidanceSeverity;
  title: string;
  detail: string;
  actions: GuidanceAction[];
  providerId?: string;
  credentialId?: string;
  chainId?: string;
  entryId?: string;
}

export interface GuidanceResponse {
  notices: GuidanceNotice[];
  summary: Record<GuidanceSeverity, number>;
  checkedAt: number;
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

export interface RouteTarget {
  providerId?: string;
  model?: string;
  credentialId?: string;
  credentialDescription?: string;
}

export interface CokeyEvent {
  id: string;
  type:
    | "route.start"
    | "route.attempt"
    | "route.switch"
    | "chain.state"
    | "route.success"
    | "route.failure"
    | "credential.cooldown"
    | "credential.invalid"
    | "credential.verified"
    | "credential.updated"
    | "chain.updated"
    | "models.updated";
  at: number;
  level: "info" | "success" | "warn" | "error";
  message: string;
  chainAlias?: string;
  providerId?: string;
  model?: string;
  credentialId?: string;
  credentialDescription?: string;
  previous?: RouteTarget;
  classification?: string;
  status?: number;
  proxyLabel?: string;
  data?: Record<string, unknown>;
}

export interface StatusResponse {
  route: LiveRouteSnapshot;
  recent: CokeyEvent[];
  subscribers: number;
}

export interface SelectableModel {
  id: string;
  providerId: string;
  context?: string;
  bestFor?: string;
  latencySeconds?: number;
  selectable: boolean;
  curated: boolean;
  live: boolean;
  firstSeenAt?: number;
  lastSeenAt?: number;
}

export interface ModelCatalogView {
  providerId: string;
  displayName: string;
  baseUrl: string;
  apiStyle: string;
  signupUrl: string;
  docsUrl?: string;
  freeTier: { advertised: boolean; summary: string; quotaSource: string };
  available: boolean;
  credentialCount: number;
  healthyCount: number;
  credentialIds: string[];

  staleModels: string[];

  inventoryCheckedAt?: number;
  counts: {
    curated: number;

    live: number;

    discovered: number;
  };
  models: SelectableModel[];
}

export interface ModelsResponse {
  providers: ModelCatalogView[];
  total: number;
  available: number;

  stale: number;
}

export interface MyModelRanking {
  providerId: string;
  displayName: string;
  model: string;
  attempts: number;
  successes: number;

  successRate?: number;
  avgLatencyMs?: number;
  lastCheckedAt?: number;
  lastOk?: boolean;
}

export interface MyModelsResponse {
  rankings: MyModelRanking[];
  tested: number;
}

export interface UsageModelView {
  model: string;
  requests: number;
  success: number;
  failure: number;
  inputTokens: number;
  outputTokens: number;
  averageLatencyMs: number;
  perCredential: Array<{
    credentialId: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
  }>;
}

export interface UsageProviderView {
  providerId: string;
  displayName: string;
  credentials: PublicCredential[];
  models: UsageModelView[];
  daily: Array<{ day: string; requests: number; inputTokens: number; outputTokens: number }>;
}

export interface UsageChainView {
  id: string;
  alias: string;
  enabled: boolean;
  entries: Array<{
    id: string;
    providerId: string;
    model: string;
    enabled: boolean;
    priority: number;
    routingStrategy: "sequential" | "round-robin";
    credentials: Array<{ id: string; description: string; status: string; active: boolean }>;
  }>;
}

export interface UsageView {
  now: LiveRouteSnapshot;
  today: string;
  providers: UsageProviderView[];
  chains: UsageChainView[];
}

export type ProviderKind = "lab" | "inference-cloud" | "aggregator" | "gateway" | "local";
export type ProviderVerdict = "recommended" | "usable" | "limited" | "avoid";

export interface CuratedModel {
  id: string;

  context?: string;
  bestFor?: string;
  latencySeconds?: number;
}

export interface ProviderDossier {
  operator: string;
  origin: string;
  kind: ProviderKind;
  summary: string;
  verdict: ProviderVerdict;
  verdictReason: string;
  sourceUrl?: string;

  reviewedAt?: string;

  freeTierSummary?: string;

  notes?: string;

  models?: CuratedModel[];
}

export interface CatalogProviderRow extends ProviderStatus {
  dossier: ProviderDossier;
}

export type QuotaProvenance = "operator" | "third-party" | "unpublished";

export interface RankingSource {
  label: string;
  url: string;
}

export interface SkillEntry {
  model: string;
  providerId?: string;
  tierName: "S" | "A" | "B" | "C";
  sweScore?: number;
  reason: string;
  reasonFr?: string;
}

export interface SkillTier {
  name: "S" | "A" | "B" | "C";
  label: string;
  labelFr?: string;
  blurb: string;
  blurbFr?: string;
}

export interface RateLimitEntry {
  providerId: string;
  provider: string;
  tier: 1 | 2 | 3 | 4;
  quota: string;
  provenance: QuotaProvenance;
  reliability: "solid" | "watch" | "avoid";
  note?: string;
  noteFr?: string;
}

export interface CombinedEntry {
  rank: number;
  providerId: string;
  model: string;
  why: string;
  whyFr?: string;
  tier: RateLimitEntry["tier"];
}

export interface RedundancyEntry {
  family: string;
  alsoOn: string[];
  keep: string;
  fallback: string;
}

export interface RankingsResponse {
  tiers: SkillTier[];
  skill: SkillEntry[];
  rateLimit: RateLimitEntry[];
  combined: CombinedEntry[];
  redundancy: RedundancyEntry[];
  dropList: Array<{ provider: string; reason: string; reasonFr?: string }>;
  bottomLine: string;
  bottomLineFr?: string;
  disclaimer: string;
  disclaimerFr?: string;
  sources: RankingSource[];

  source: "remote" | "compiled";

  fetchedAt?: string;

  funFacts?: string[];

  funFactsFr?: string[];
}
