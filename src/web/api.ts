import type {
  ApiKeyView,
  CatalogProviderRow,
  ChainView,
  ConnectResult,
  GuidanceResponse,
  ModelDiscoveryReport,
  ModelProbeResult,
  ModelsResponse,
  MyModelsResponse,
  Nudge,
  PageParams,
  Paginated,
  ProviderCatalogEntry,
  ProviderModelInventory,
  ProviderStatus,
  ProxyPoolBulkResponse,
  ProxyPoolCheckResponse,
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
import { reportInsightAttempt, reportInsightFailure } from "./insights-bus.js";

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

export function pageQuery(
  params: PageParams = {},
  extra: Record<string, string | number | undefined> = {},
): string {
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

export const api = {
  health: () => request<{ ok: boolean; version: string; dataDir: string }>("GET", "/health"),
  stats: () => request<Stats>("GET", "/api/stats"),
  nudge: () => request<Nudge>("GET", "/api/nudge"),

  providers: (params: PageParams = {}) =>
    request<Paginated<ProviderStatus>>("GET", `/api/providers${pageQuery(params)}`),

  allProviders: async (): Promise<ProviderStatus[]> =>
    (await request<Paginated<ProviderStatus>>("GET", "/api/providers?pageSize=0")).data,

  catalogProviders: (params: PageParams = {}) =>
    request<Paginated<CatalogProviderRow>>("GET", `/api/catalog/providers${pageQuery(params)}`),

  rankings: () => request<RankingsResponse>("GET", "/api/catalog/rankings"),

  refreshRankings: () =>
    request<{ changed: boolean; rankings?: RankingsResponse; message?: string }>(
      "POST",
      "/api/catalog/rankings/refresh",
    ),

  probeModel: (body: { providerId: string; model: string; credentialId?: string }) =>
    request<ModelProbeResult>("POST", "/api/models/probe", body).then((result) => {
      reportInsightAttempt("model");
      if (!result.ok) reportInsightFailure(result.classification);
      return result;
    }),

  proxyPool: () => request<ProxyPoolResponse>("GET", "/api/proxy-pool"),
  addProxy: (url: string) => request<ProxyPoolResponse>("POST", "/api/proxy-pool", { url }),
  addProxiesBulk: (text: string) =>
    request<ProxyPoolBulkResponse>("POST", "/api/proxy-pool/bulk", { text }),
  setProxyEnabled: (id: string, enabled: boolean) =>
    request<ProxyPoolResponse>("PATCH", `/api/proxy-pool/${id}`, { enabled }),
  removeProxy: (id: string) => request<ProxyPoolResponse>("DELETE", `/api/proxy-pool/${id}`),
  syncProxyPool: () =>
    request<ProxyPoolResponse & { changed: number }>("POST", "/api/proxy-pool/sync"),
  fetchProxifly: (limit?: number, verify?: boolean) =>
    request<ProxyPoolBulkResponse & { source: "proxifly-free" }>(
      "POST",
      "/api/proxy-pool/fetch-proxifly",
      { limit, verify },
    ),

  checkProxyPool: (body?: { concurrency?: number; timeoutMs?: number; prune?: boolean }) =>
    request<ProxyPoolCheckResponse>("POST", "/api/proxy-pool/check", body ?? {}),

  connectProvider: (
    providerId: string,
    body: {
      secret: string;
      description: string;
      accountId?: string;
      proxyUrl?: string;

      saveAnyway?: boolean;

      useProxy?: boolean;
    },
  ) =>
    request<ConnectResult>(
      "POST",
      `/api/providers/${encodeURIComponent(providerId)}/connect`,
      body,
    ),

  testProviderSecret: (
    providerId: string,
    body: { secret: string; accountId?: string; model?: string; useProxy?: boolean },
  ) =>
    request<ValidationResult>(
      "POST",
      `/api/providers/${encodeURIComponent(providerId)}/test`,
      body,
    ).then((result) => {
      reportInsightAttempt("credential");
      if (!result.ok) reportInsightFailure(result.classification);
      return result;
    }),

  models: () => request<ModelsResponse>("GET", "/api/models"),

  myModels: () => request<MyModelsResponse>("GET", "/api/models/mine"),

  refreshProviderModels: (providerId: string) =>
    request<ModelDiscoveryReport>(
      "POST",
      `/api/providers/${encodeURIComponent(providerId)}/refresh-models`,
    ),

  refreshAllProviderModels: () =>
    request<{
      reports: ModelDiscoveryReport[];
      refreshed: number;
      failed: number;
      added: number;
      removed: number;
      stale: number;
    }>("POST", "/api/providers/refresh-models"),

  providerModels: (providerId: string) =>
    request<ProviderModelInventory>(
      "GET",
      `/api/providers/${encodeURIComponent(providerId)}/models`,
    ),

  guidance: () => request<GuidanceResponse>("GET", "/api/guidance"),

  status: (limit = 30) => request<StatusResponse>("GET", `/api/status?limit=${limit}`),

  eventsUrl: (topics?: readonly string[]) =>
    topics && topics.length > 0
      ? `/api/events?topics=${encodeURIComponent(topics.join(","))}`
      : "/api/events",

  chains: () => request<ChainView[]>("GET", "/api/chains"),
  createChain: (body: { alias: string; description?: string }) =>
    request<ChainView>("POST", "/api/chains", body),
  updateChain: (
    id: string,
    body: { alias?: string; description?: string | null; enabled?: boolean },
  ) => request<ChainView>("PATCH", `/api/chains/${id}`, body),
  deleteChain: (id: string) => request<{ ok: boolean }>("DELETE", `/api/chains/${id}`),
  reorderChains: (chainIds: string[]) =>
    request<{ ok: boolean }>("POST", "/api/chains/reorder", { chainIds }),
  reorderChain: (id: string, entryIds: string[]) =>
    request<{ ok: boolean }>("POST", `/api/chains/${id}/reorder`, { entryIds }),

  addEntry: (
    chainId: string,
    body: {
      providerId: string;
      model: string;

      label?: string;
      credentialIds: string[];
      routingStrategy?: string;
    },
  ) => request<ChainView["entries"][number]>("POST", `/api/chains/${chainId}/entries`, body),
  updateEntry: (
    entryId: string,
    body: {
      model?: string;

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

      saveAnyway?: boolean;

      useProxy?: boolean;
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

  credentials: (params: PageParams = {}) =>
    request<Paginated<PublicCredential>>("GET", `/api/credentials${pageQuery(params)}`),

  allCredentials: async (): Promise<PublicCredential[]> =>
    (await request<Paginated<PublicCredential>>("GET", "/api/credentials?pageSize=0")).data,
  updateCredential: (
    id: string,
    body: {
      description?: string;
      accountId?: string | null;
      secret?: string;
      status?: string;

      proxyUrl?: string | null;

      proxyPoolId?: string | null;
    },
  ) => request<PublicCredential>("PATCH", `/api/credentials/${id}`, body),
  deleteCredential: (id: string) => request<{ ok: boolean }>("DELETE", `/api/credentials/${id}`),
  testCredential: (id: string) =>
    request<ValidationResult>("POST", `/api/credentials/${id}/test`).then((result) => {
      reportInsightAttempt("credential");
      if (!result.ok) reportInsightFailure(result.classification);
      return result;
    }),
  credentialQuota: (id: string) =>
    request<{ quota: PublicCredential["quota"]; usage: PublicCredential["usage"] }>(
      "GET",
      `/api/credentials/${id}/quota`,
    ),

  requests: (
    params: PageParams = { pageSize: 25 },
    filters: { outcome?: string; providerId?: string } = {},
  ) =>
    request<Paginated<RequestLogEntry> & { stats: Stats["history"] }>(
      "GET",
      `/api/requests${pageQuery(params, filters)}`,
    ),
  clearRequests: () => request<{ ok: boolean }>("DELETE", "/api/requests"),

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

  login: (password: string) =>
    request<{ authenticated: boolean; passwordLocked: boolean }>("POST", "/api/session", {
      password,
    }),
  logout: () => request<{ ok: boolean }>("DELETE", "/api/session"),
  setPassword: (password: string) =>
    request<{ ok: boolean; passwordLocked: boolean }>("POST", "/api/password", { password }),

  apiKeys: () => request<{ data: ApiKeyView[] }>("GET", "/api/keys"),
  createApiKey: (name: string) =>
    request<{ key: string; view: ApiKeyView }>("POST", "/api/keys", { name }),
  revokeApiKey: (id: string) => request<{ ok: boolean }>("DELETE", `/api/keys/${id}`),
};

export function timeAgo(timestamp: number): string {
  const delta = Date.now() - timestamp;
  if (delta < 5_000) return "just now";
  if (delta < 60_000) return `${Math.round(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)}h ago`;
  return `${Math.round(delta / 86_400_000)}d ago`;
}
