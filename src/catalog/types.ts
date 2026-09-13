/**
 * Types describing the curated provider catalog.
 *
 * The catalog is data, not code paths: users select a provider from this list
 * and never type a base URL or auth scheme themselves.
 */

/**
 * Wire format spoken by a provider.
 *
 * `openai` covers every OpenAI-compatible service (the vast majority).
 * The others exist only where the request/response shape genuinely differs.
 */
export type ApiStyle = "openai" | "anthropic" | "google" | "cohere" | "cloudflare" | "ollama";

export type AuthScheme = "bearer" | "x-api-key" | "query-param" | "custom-header";

/**
 * Whether a provider explicitly advertises a free tier.
 *
 * COKEY only shows a "Free" badge when `advertised` is true. Trial credits and
 * inferred generosity deliberately do not qualify.
 */
export interface FreeTierInfo {
  advertised: boolean;
  summary: string;
  quotaSource: "provider" | "unknown";
}

/**
 * How to prove that a credential works before it is allowed into a chain.
 *
 * - `chat`   performs a tiny completion against `model`.
 * - `models` calls the provider's model-listing endpoint (cheaper, no tokens).
 */
export interface VerificationSpec {
  method: "chat" | "models";
  /** Model id used for the `chat` method. */
  model?: string;
}

export interface ProviderCatalogEntry {
  /** Stable identifier used everywhere on disk and over the API. */
  id: string;
  displayName: string;
  baseUrl: string;
  apiStyle: ApiStyle;
  authScheme: AuthScheme;
  /** Where a user goes to create a key. */
  signupUrl: string;
  docsUrl?: string;
  freeTier: FreeTierInfo;
  /** Static headers a provider requires on every request. */
  extraHeaders?: Record<string, string>;
  /**
   * Curated free-only model list. Paid-only models are intentionally absent:
   * if a model is not free, it does not appear in the Add-Chain picker.
   */
  knownModels: string[];
  /** Extra credential fields beyond the secret (Cloudflare needs an account id). */
  credentialFields: Array<"secret" | "accountId">;
  verification: VerificationSpec;
  /** Human note for anything surprising, surfaced in the UI tooltip. */
  notes?: string;
}

/** A catalog entry plus the user's connection state, as returned by the API. */
export interface ProviderStatus extends ProviderCatalogEntry {
  connected: boolean;
  credentialCount: number;
  healthyCount: number;
}
