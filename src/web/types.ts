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
  quotaErrors: number;
  authErrors: number;
  serverErrors: number;
  averageLatencyMs: number;
  lastUsedAt?: number;
  cooldownCount: number;
}

/** Proxy state of a credential. Never carries the proxy's own credentials. */
export interface CredentialProxyInfo {
  configured: boolean;
  /** True when the automatic pool chose this exit rather than the user. */
  auto: boolean;
  /** `host:port` of the egress proxy. */
  label?: string;
}

/**
 * Locally measured throughput for one key.
 *
 * This is what makes two keys from the same provider distinguishable: the
 * provider's own quota is often unknown or identical across keys, but the
 * observed rate is always specific to the credential.
 */
export interface CredentialRate {
  requestsPerMinute: number;
  requestsLast5Minutes: number;
  recentlyRateLimited: boolean;
  /** 12 buckets of 5 seconds covering the last minute, oldest first. */
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
  /**
   * Display name chosen by the user.
   *
   * COKEY never derives this from the model id: "DeepSeek V4 Pro (xKiro)" is
   * something a person types, not something the gateway invents.
   */
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
  /** Spread pool proxies across same-provider keys without manual wiring. */
  autoProxy: boolean;
  autoProxyStrategy: AutoProxyStrategy;
  proxyPoolSize: number;
  fallback: FallbackPolicy;
  passwordLocked: boolean;
}

export type AutoProxyStrategy = "per-provider" | "round-robin";

/** The envelope every paginated endpoint returns. */
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

/** One entry in the automatic egress pool. */
export interface ProxyPoolEntryView {
  id: string;
  /** `host:port` only. The proxy's own credentials never leave the server. */
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
  /** Providers with more keys than the pool, so sharing is unavoidable. */
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
  /** Present when the fetch verified candidates before importing. */
  checked?: number;
  alive?: number;
  dead?: number;
}

/** Result of a pool sweep: how many exits are still alive, how many dropped. */
export interface ProxyPoolCheckResponse extends ProxyPoolResponse {
  checked: number;
  healthy: number;
  dead: string[];
  removed: number;
}

/** Result of the model play button: a real request, not a cached status. */
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
  /** What the provider reported serving, when the key verified. */
  models?: ModelDiscoveryReport;
}

// ---- provider model inventory --------------------------------------------

/**
 * What changed about a provider's model list on the last check.
 *
 * The three lists are kept apart because they mean different things to a user:
 * `added` is new capability, `restored` is a model that came back after being
 * retired, and `removed` is a model that stopped being served. Collapsing them
 * into one count would lose exactly the information that makes the refresh
 * worth running.
 */
export interface ModelDiscoveryReport {
  added: string[];
  restored: string[];
  removed: string[];
  /** Missing models old enough to be forgotten entirely. */
  pruned: number;
  /** Catalogued models the provider did not return. */
  stale: string[];
  /** Returned models the curated catalog does not list. */
  uncurated: string[];
  /** Records that were already live and still are. */
  unchanged: number;
  providerId: string;
  displayName: string;
  ok: boolean;
  /** Why the check could not be trusted, when `ok` is false. */
  message?: string;
  latencyMs: number;
  checkedAt: number;
  /** How many models the provider returned. */
  discovered: number;
  /** How many rows the provider's inventory holds after the check. */
  tracked: number;
}

/** One observed model, with the provenance of the observation. */
export interface ProviderModelRecordView {
  providerId: string;
  model: string;
  /** True when the shipped catalog also lists this model. */
  curated: boolean;
  /** True when the provider returned it on the most recent check. */
  available: boolean;
  firstSeen: number;
  lastSeen: number;
  lastChecked: number;
}

export interface ProviderModelInventory {
  providerId: string;
  displayName: string;
  /** Absent when this provider's model list has never been fetched. */
  checkedAt?: number;
  models: ProviderModelRecordView[];
}

// ---- guidance -------------------------------------------------------------

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
  | "content.files-broken"
  | "content.dossiers-outdated"
  | "content.unsupported"
  | "coverage.free-providers";

/**
 * What a notice's button does.
 *
 * A closed set rather than a free-form callback: these cross a JSON boundary,
 * and the UI has to be able to render every one of them as a button that does
 * something real. A notice without an action is a complaint.
 */
export type GuidanceAction =
  | { kind: "navigate"; label: string; path: string }
  | { kind: "refresh-models"; label: string; providerId: string }
  | { kind: "reverify-credential"; label: string; credentialId: string }
  /** Re-read the curated content directory; does not cross a credential. */
  | { kind: "reload-content"; label: string };

export interface GuidanceNotice {
  /** Stable across snapshots, so a dismissal can be remembered. */
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

/** What the router is doing right now. */
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

/** The target a switch moved away from. */
export interface RouteTarget {
  providerId?: string;
  model?: string;
  credentialId?: string;
  credentialDescription?: string;
}

/** One routing notification, streamed over SSE. */
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

/**
 * A model the user might pick.
 *
 * Three independent questions, kept as three fields rather than collapsed into
 * one: is it in the hand-written catalog (`curated`), does the provider still
 * serve it (`live`), and may the user select it right now (`selectable`, which
 * is true only when the provider holds a verified key).
 */
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
  /** Catalogued models the provider did not return on the last check. */
  staleModels: string[];
  /** Absent when this provider's model list has never been fetched. */
  inventoryCheckedAt?: number;
  counts: {
    curated: number;
    /** Curated models the provider still returns. */
    live: number;
    /** Models the provider returns that the catalog does not list. */
    discovered: number;
  };
  models: SelectableModel[];
}

export interface ModelsResponse {
  providers: ModelCatalogView[];
  total: number;
  available: number;
  /** Catalogued models no provider returns any more, summed. */
  stale: number;
}

/** Per-model usage inside one provider. */
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

/** Per-provider usage: connected keys, model rollups and daily totals. */
export interface UsageProviderView {
  providerId: string;
  displayName: string;
  credentials: PublicCredential[];
  models: UsageModelView[];
  daily: Array<{ day: string; requests: number; inputTokens: number; outputTokens: number }>;
}

/** Chain/entry/key topology with the currently active key flagged. */
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

// ---- catalog intelligence -------------------------------------------------

export type ProviderKind = "lab" | "inference-cloud" | "aggregator" | "gateway" | "local";
export type ProviderVerdict = "recommended" | "usable" | "limited" | "avoid";

export interface CuratedModel {
  id: string;
  /** Advertised context window, as a display string (e.g. "262K"). */
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
  /** `cms` when the content repository supplied this entry, `compiled` otherwise. */
  source?: "cms" | "compiled";
  /** ISO date a human last checked these claims. */
  reviewedAt?: string;
  /** One-line free-tier summary, when the content records one. */
  freeTierSummary?: string;
  /** The editor's caveat, when there is one. */
  notes?: string;
  /** Free model list as curated, when the content repository lists one. */
  models?: CuratedModel[];
}

export interface ProviderDossierResponse {
  providerId: string;
  dossier: ProviderDossier;
  /** Whether the provider exists in the live catalog at all. */
  known: boolean;
}

/* -------------------------------------------------------------------------- *\
 * Curated content
\* -------------------------------------------------------------------------- */

export interface CmsIssue {
  file: string;
  message: string;
}

/** Where the curated content came from, and what was wrong with it. */
export interface ContentStatusResponse {
  /** True when a content directory was found and read. */
  available: boolean;
  directory: string;
  watching: boolean;
  loadedAt: number;
  counts: {
    providers: number;
    models: number;
    terms: number;
    ranked: number;
    skill: number;
    issues: number;
  };
  issues: CmsIssue[];
  /** Providers the content documents that this build cannot serve. */
  unsupportedProviders: string[];
}

export interface TermsSection {
  slug: string;
  title: string;
  order: number;
  updatedAt: string;
  /** Markdown body. */
  body: string;
}

export interface TermsResponse {
  sections: TermsSection[];
  updatedAt?: string;
}

/** A provider card with its dossier folded in. */
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
}

export interface SkillTier {
  name: "S" | "A" | "B" | "C";
  label: string;
  blurb: string;
}

export interface RateLimitEntry {
  providerId: string;
  provider: string;
  tier: 1 | 2 | 3 | 4;
  quota: string;
  provenance: QuotaProvenance;
  reliability: "solid" | "watch" | "avoid";
  note?: string;
}

export interface CombinedEntry {
  rank: number;
  providerId: string;
  model: string;
  why: string;
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
  dropList: Array<{ provider: string; reason: string }>;
  bottomLine: string;
  disclaimer: string;
  sources: RankingSource[];
  /** Where these boards came from, so the screen can say so honestly. */
  source: "cms" | "compiled";
  /** ISO date of the newest review behind the boards. */
  reviewedAt?: string;
}
