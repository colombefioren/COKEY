import type {
  ChainView,
  ConnectResult,
  ModelsResponse,
  Nudge,
  ProviderCatalogEntry,
  ProviderStatus,
  PublicCredential,
  RequestLogEntry,
  Settings,
  Stats,
  StatusResponse,
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
  const stored = localStorage.getItem("cokey_auth_token");
  if (stored) headers.Authorization = `Bearer ${stored}`;
  if (body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(path, {
    method,
    headers,
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

/** Typed wrapper around every management endpoint the UI uses. */
export const api = {
  health: () => request<{ ok: boolean; version: string; dataDir: string }>("GET", "/health"),
  stats: () => request<Stats>("GET", "/api/stats"),
  nudge: () => request<Nudge>("GET", "/api/nudge"),
  providers: () => request<ProviderStatus[]>("GET", "/api/providers"),
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
    body: { providerId: string; model: string; credentialIds: string[]; routingStrategy?: string },
  ) => request<ChainView["entries"][number]>("POST", `/api/chains/${chainId}/entries`, body),
  updateEntry: (
    entryId: string,
    body: { model?: string; enabled?: boolean; routingStrategy?: "sequential" | "round-robin" },
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

  credentials: () => request<PublicCredential[]>("GET", "/api/credentials"),
  updateCredential: (
    id: string,
    body: {
      description?: string;
      accountId?: string | null;
      secret?: string;
      status?: string;
      /** `null` clears the proxy and restores direct egress. */
      proxyUrl?: string | null;
    },
  ) => request<PublicCredential>("PATCH", `/api/credentials/${id}`, body),
  deleteCredential: (id: string) => request<{ ok: boolean }>("DELETE", `/api/credentials/${id}`),
  testCredential: (id: string) => request<ValidationResult>("POST", `/api/credentials/${id}/test`),
  credentialQuota: (id: string) =>
    request<{ quota: PublicCredential["quota"]; usage: PublicCredential["usage"] }>(
      "GET",
      `/api/credentials/${id}/quota`,
    ),

  requests: (limit = 100) =>
    request<{ data: RequestLogEntry[]; stats: Stats["history"] }>(
      "GET",
      `/api/requests?limit=${limit}`,
    ),
  clearRequests: () => request<{ ok: boolean }>("DELETE", "/api/requests"),

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

  // ---- management auth ------------------------------------------------------

  authTokenStatus: () => request<{ authTokenConfigured: boolean }>("GET", "/api/auth-token"),
  generateAuthToken: () => request<{ authToken: string }>("POST", "/api/auth-token"),
  revokeAuthToken: () =>
    request<{ ok: boolean; authTokenConfigured: boolean }>("DELETE", "/api/auth-token"),
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
