import { PROVIDER_CATALOG, PROVIDER_ALIASES, findProvider } from "../../catalog/providers.js";
import { mergeProviderEntries } from "../../catalog/dedupe.js";
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
    // The shipped catalog lists a few services more than once. Merging first
    // means a sparse duplicate can never erase the curated model list of the
    // entry it duplicates, and the UI shows one card per real service.
    const canonical = mergeProviderEntries(PROVIDER_CATALOG);
    for (const entry of canonical) this.register(entry);

    // Stored chains and older exports may reference a collapsed id, so every
    // alias resolves to the same catalog entry and the same adapter.
    for (const [alias, target] of PROVIDER_ALIASES) {
      const entry = this.entries.get(target);
      const adapter = this.adapters.get(target);
      if (!entry || !adapter) continue;
      this.entries.set(alias, entry);
      this.adapters.set(alias, adapter);
    }

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

  /**
   * The canonical catalog, one entry per service, aliases excluded.
   *
   * An alias key is registered pointing at the *same entry object* as its
   * canonical id (see the constructor), so `entry.id` is always the canonical
   * id no matter which key retrieved it — filtering on `entry.id` can never
   * see the alias key and lets the object through twice. Filtering on the map
   * key itself is what actually excludes the alias.
   */
  getCatalog(): ProviderCatalogEntry[] {
    const aliases = new Set(PROVIDER_ALIASES.keys());
    return [...this.entries.entries()]
      .filter(([id]) => !aliases.has(id))
      .map(([, entry]) => entry);
  }

  /**
   * Only providers shipped with COKEY, excluding user custom endpoints.
   *
   * Aliases are filtered out by map key (see `getCatalog`) so a merged
   * service yields exactly one card instead of one per alias.
   */
  getBuiltInCatalog(): ProviderCatalogEntry[] {
    const aliases = new Set(PROVIDER_ALIASES.keys());
    return [...this.entries.entries()]
      .filter(([id]) => !id.startsWith(CUSTOM_PREFIX) && !aliases.has(id))
      .map(([, entry]) => entry);
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
