import type {
  ApiKeyView,
  CatalogProviderRow,
  ChainView,
  ConnectResult,
  ModelProbeResult,
  ModelsResponse,
  Nudge,
  PageParams,
  Paginated,
  ProviderCatalogEntry,
  ProviderStatus,
  ProxyPoolBulkResponse,
  ProxyPoolResponse,
  PublicCredential,
  RankingsResponse,
  RequestLogEntry,
  Settings,
  Stats,
  StatusResponse,
  UsageView,
  ValidationResult,
} from "./types.js";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly classification?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const payload = data as { error?: { message?: string; classification?: string } } | undefined;
    throw new ApiError(
      payload?.error?.message ?? response.statusText,
      response.status,
      payload?.error?.classification,
    );
  }

  return data as T;
}

/** Serialise `page` / `pageSize` / `q` into a query string. */
export function pageQuery(params: PageParams = {}, extra: Record<string, string | number | undefined> = {}): string {
  const search = new URLSearchParams();
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.pageSize !== undefined) search.set("pageSize", String(params.pageSize));
  if (params.q) search.set("q", params.q);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Typed wrapper around every management endpoint the UI uses. */
export const api = {
  health: () => request<{ ok: boolean; version: string; dataDir: string }>("GET", "/health"),
  stats: () => request<Stats>("GET", "/api/stats"),
  nudge: () => request<Nudge>("GET", "/api/nudge"),

  /** Paginated provider list. Use `allProviders` when you need everything. */
  providers: (params: PageParams = {}) =>
    request<Paginated<ProviderStatus>>("GET", `/api/providers${pageQuery(params)}`),
  /** Every provider in one response. For pickers and joins, not tables. */
  allProviders: async (): Promise<ProviderStatus[]> =>
    (await request<Paginated<ProviderStatus>>("GET", "/api/providers?pageSize=0")).data,

  /** Provider cards with operator dossiers attached. */
  catalogProviders: (params: PageParams = {}) =>
    request<Paginated<CatalogProviderRow>>("GET", `/api/catalog/providers${pageQuery(params)}`),

  /** Skill, rate-limit and combined ranking boards, with their sources. */
  rankings: () => request<RankingsResponse>("GET", "/api/catalog/rankings"),

  /** Send a real hello through one working key. The play button. */
  probeModel: (body: { providerId: string; model: string; credentialId?: string }) =>
    request<ModelProbeResult>("POST", "/api/models/probe", body),

  // ---- automatic egress pool ------------------------------------------------

  proxyPool: () => request<ProxyPoolResponse>("GET", "/api/proxy-pool"),
  addProxy: (url: string) => request<ProxyPoolResponse>("POST", "/api/proxy-pool", { url }),
  addProxiesBulk: (text: string) =>
    request<ProxyPoolBulkResponse>("POST", "/api/proxy-pool/bulk", { text }),
  setProxyEnabled: (id: string, enabled: boolean) =>
    request<ProxyPoolResponse>("PATCH", `/api/proxy-pool/${id}`, { enabled }),
  removeProxy: (id: string) => request<ProxyPoolResponse>("DELETE", `/api/proxy-pool/${id}`),
  syncProxyPool: () =>
    request<ProxyPoolResponse & { changed: number }>("POST", "/api/proxy-pool/sync"),

  connectProvider: (
    providerId: string,
    body: { secret: string; description: string; accountId?: string; proxyUrl?: string },
  ) =>
    request<ConnectResult>(
      "POST",
      `/api/providers/${encodeURIComponent(providerId)}/connect`,
      body,
    ),

  /**
   * The curated free-model catalog with availability folded in.
   *
   * `selectable` is false for every model whose provider has no healthy key, so
   * the UI can show the whole list while only allowing usable picks.
   */
  models: () => request<ModelsResponse>("GET", "/api/models"),

  /** Current route plus recent routing events. */
  status: (limit = 30) => request<StatusResponse>("GET", `/api/status?limit=${limit}`),

  /** URL of the live routing event stream, consumed with EventSource. */
  eventsUrl: () => "/api/events",

  chains: () => request<ChainView[]>("GET", "/api/chains"),
  createChain: (body: { alias: string; description?: string }) =>
    request<ChainView>("POST", "/api/chains", body),
  updateChain: (
    id: string,
    body: { alias?: string; description?: string | null; enabled?: boolean },
  ) => request<ChainView>("PATCH", `/api/chains/${id}`, body),
  deleteChain: (id: string) => request<{ ok: boolean }>("DELETE", `/api/chains/${id}`),
  reorderChain: (id: string, entryIds: string[]) =>
    request<{ ok: boolean }>("POST", `/api/chains/${id}/reorder`, { entryIds }),

  addEntry: (
    chainId: string,
    body: {
      providerId: string;
      model: string;
      /** Optional user-chosen display name. */
      label?: string;
      credentialIds: string[];
      routingStrategy?: string;
    },
  ) => request<ChainView["entries"][number]>("POST", `/api/chains/${chainId}/entries`, body),
  updateEntry: (
    entryId: string,
    body: {
      model?: string;
      /** `null` or an empty string clears the display name. */
      label?: string | null;
      enabled?: boolean;
      routingStrategy?: "sequential" | "round-robin";
    },
  ) => request<ChainView["entries"][number]>("PATCH", `/api/entries/${entryId}`, body),
  deleteEntry: (entryId: string) => request<{ ok: boolean }>("DELETE", `/api/entries/${entryId}`),
  testEntry: (entryId: string) =>
    request<ValidationResult & { credentialId?: string }>("POST", `/api/entries/${entryId}/test`),
  duplicateEntry: (entryId: string) =>
    request<ChainView["entries"][number]>("POST", `/api/entries/${entryId}/duplicate`),
  moveEntry: (entryId: string, toIndex: number) =>
    request<{ ok: boolean }>("POST", `/api/entries/${entryId}/move`, { toIndex }),

  addEntryCredential: (
    entryId: string,
    body: {
      credentialId?: string;
      secret?: string;
      description?: string;
      accountId?: string;
      proxyUrl?: string;
      addAnyway?: boolean;
    },
  ) =>
    request<{
      credential: PublicCredential;
      validation: ValidationResult;
      attached: boolean;
      error?: { message: string };
    }>("POST", `/api/entries/${entryId}/credentials`, body),
  removeEntryCredential: (entryId: string, credentialId: string) =>
    request<{ ok: boolean }>("DELETE", `/api/entries/${entryId}/credentials/${credentialId}`),

  /** Paginated credential inventory. */
  credentials: (params: PageParams = {}) =>
    request<Paginated<PublicCredential>>("GET", `/api/credentials${pageQuery(params)}`),
  /** Every credential in one response, for joins and exports. */
  allCredentials: async (): Promise<PublicCredential[]> =>
    (await request<Paginated<PublicCredential>>("GET", "/api/credentials?pageSize=0")).data,
  updateCredential: (
    id: string,
    body: {
      description?: string;
      accountId?: string | null;
      secret?: string;
      status?: string;
      /** `null` clears the proxy and restores direct egress. */
      proxyUrl?: string | null;
      /** Pin to a pool entry by id, or `null` to return the key to the pool. */
      proxyPoolId?: string | null;
    },
  ) => request<PublicCredential>("PATCH", `/api/credentials/${id}`, body),
  deleteCredential: (id: string) => request<{ ok: boolean }>("DELETE", `/api/credentials/${id}`),
  testCredential: (id: string) => request<ValidationResult>("POST", `/api/credentials/${id}/test`),
  credentialQuota: (id: string) =>
    request<{ quota: PublicCredential["quota"]; usage: PublicCredential["usage"] }>(
      "GET",
      `/api/credentials/${id}/quota`,
    ),

  /** Paginated request history, with the rollup stats alongside the page. */
  requests: (
    params: PageParams = { pageSize: 25 },
    filters: { outcome?: string; providerId?: string } = {},
  ) =>
    request<Paginated<RequestLogEntry> & { stats: Stats["history"] }>(
      "GET",
      `/api/requests${pageQuery(params, filters)}`,
    ),
  clearRequests: () => request<{ ok: boolean }>("DELETE", "/api/requests"),

  /** Per provider → key → model usage, live route, and chain topology. */
  usage: () => request<UsageView>("GET", "/api/usage"),

  settings: () => request<Settings>("GET", "/api/settings"),
  updateSettings: (body: Record<string, unknown>) =>
    request<Settings>("PATCH", "/api/settings", body),
  resetSettings: () => request<Settings>("POST", "/api/settings/reset"),

  customEndpoints: () => request<ProviderCatalogEntry[]>("GET", "/api/custom-endpoints"),
  addCustomEndpoint: (body: {
    displayName: string;
    baseUrl: string;
    apiStyle?: string;
    authScheme?: string;
    models?: string[];
  }) => request<ProviderCatalogEntry>("POST", "/api/custom-endpoints", body),
  deleteCustomEndpoint: (providerId: string) =>
    request<{ ok: boolean }>(
      "DELETE",
      `/api/custom-endpoints/${encodeURIComponent(providerId.replace(/^custom:/, ""))}`,
    ),

  // ---- session --------------------------------------------------------------

  login: (password: string) =>
    request<{ authenticated: boolean; passwordLocked: boolean }>("POST", "/api/session", {
      password,
    }),
  logout: () => request<{ ok: boolean }>("DELETE", "/api/session"),
  setPassword: (password: string) =>
    request<{ ok: boolean; passwordLocked: boolean }>("POST", "/api/password", { password }),

  // ---- api keys -------------------------------------------------------------

  apiKeys: () => request<{ data: ApiKeyView[] }>("GET", "/api/keys"),
  createApiKey: (name: string) =>
    request<{ key: string; view: ApiKeyView }>("POST", "/api/keys", { name }),
  revokeApiKey: (id: string) => request<{ ok: boolean }>("DELETE", `/api/keys/${id}`),
};

/** Human-friendly relative time for tables. */
export function timeAgo(timestamp: number): string {
  const delta = Date.now() - timestamp;
  if (delta < 5_000) return "just now";
  if (delta < 60_000) return `${Math.round(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)}h ago`;
  return `${Math.round(delta / 86_400_000)}d ago`;
}
