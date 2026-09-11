import { PROVIDER_CATALOG, findProvider } from "../../catalog/providers.js";
import type { ApiStyle, AuthScheme, ProviderCatalogEntry } from "../../catalog/types.js";
import type { CustomEndpointRow } from "../db/database.js";
import type { ProviderAdapter } from "./adapter.js";
import { AnthropicAdapter } from "./anthropic.js";
import { CloudflareAdapter } from "./cloudflare.js";
import { CohereAdapter } from "./cohere.js";
import { GoogleAdapter } from "./google.js";
import { OllamaAdapter } from "./ollama.js";
import { OpenAICompatibleAdapter } from "./openai-compatible.js";

/** Prefix applied to custom endpoint ids so they can never shadow the catalog. */
export const CUSTOM_PREFIX = "custom:";

/**
 * Maps catalog entries (and user-supplied custom endpoints) onto adapters.
 *
 * The catalog is data; this class is the only place that decides which code
 * speaks for a given `apiStyle`.
 */
export class ProviderRegistry {
  private readonly entries = new Map<string, ProviderCatalogEntry>();
  private readonly adapters = new Map<string, ProviderAdapter>();

  constructor(customEndpoints: CustomEndpointRow[] = []) {
    for (const entry of PROVIDER_CATALOG) this.register(entry);
    for (const row of customEndpoints) this.registerCustom(row);
  }

  /** Replace the custom endpoint set without disturbing the shipped catalog. */
  syncCustomEndpoints(rows: CustomEndpointRow[]): void {
    for (const id of [...this.entries.keys()]) {
      if (id.startsWith(CUSTOM_PREFIX)) {
        this.entries.delete(id);
        this.adapters.delete(id);
      }
    }
    for (const row of rows) this.registerCustom(row);
  }

  register(entry: ProviderCatalogEntry): void {
    this.entries.set(entry.id, entry);
    this.adapters.set(entry.id, createAdapter(entry));
  }

  registerCustom(row: CustomEndpointRow): ProviderCatalogEntry {
    const entry = customEndpointToCatalogEntry(row);
    this.entries.set(entry.id, entry);
    this.adapters.set(entry.id, createAdapter(entry));
    return entry;
  }

  getCatalog(): ProviderCatalogEntry[] {
    return [...this.entries.values()];
  }

  /** Only providers shipped with COKEY, excluding user custom endpoints. */
  getBuiltInCatalog(): ProviderCatalogEntry[] {
    return [...this.entries.values()].filter((entry) => !entry.id.startsWith(CUSTOM_PREFIX));
  }

  findCatalogEntry(id: string): ProviderCatalogEntry | undefined {
    return this.entries.get(id) ?? findProvider(id);
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  get(id: string): ProviderAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error(`Unknown provider: ${id}`);
    return adapter;
  }

  isCustom(id: string): boolean {
    return id.startsWith(CUSTOM_PREFIX);
  }
}

export function createAdapter(entry: ProviderCatalogEntry): ProviderAdapter {
  switch (entry.apiStyle) {
    case "cloudflare":
      return new CloudflareAdapter(entry);
    case "google":
      return new GoogleAdapter(entry);
    case "cohere":
      return new CohereAdapter(entry);
    case "ollama":
      return new OllamaAdapter(entry);
    case "anthropic":
      return new AnthropicAdapter(entry);
    case "openai":
    default:
      return new OpenAICompatibleAdapter(entry);
  }
}

/** Project a stored custom endpoint into the catalog shape. */
export function customEndpointToCatalogEntry(row: CustomEndpointRow): ProviderCatalogEntry {
  return {
    id: `${CUSTOM_PREFIX}${row.id}`,
    displayName: row.display_name,
    baseUrl: row.base_url,
    apiStyle: row.api_style as ApiStyle,
    authScheme: row.auth_scheme as AuthScheme,
    signupUrl: "",
    freeTier: { advertised: false, summary: "Custom endpoint", quotaSource: "unknown" },
    knownModels: parseModels(row.models),
    credentialFields: ["secret"],
    verification: { method: "models" },
    notes: "User-supplied OpenAI-compatible endpoint. Not part of the curated catalog.",
  };
}

function parseModels(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
