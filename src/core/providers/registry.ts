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

export const CUSTOM_PREFIX = "custom:";

export class ProviderRegistry {
  private readonly entries = new Map<string, ProviderCatalogEntry>();
  private readonly adapters = new Map<string, ProviderAdapter>();

  constructor(customEndpoints: CustomEndpointRow[] = []) {
    const canonical = mergeProviderEntries(PROVIDER_CATALOG);
    for (const entry of canonical) this.register(entry);

    for (const [alias, target] of PROVIDER_ALIASES) {
      const entry = this.entries.get(target);
      const adapter = this.adapters.get(target);
      if (!entry || !adapter) continue;
      this.entries.set(alias, entry);
      this.adapters.set(alias, adapter);
    }

    for (const row of customEndpoints) this.registerCustom(row);
  }

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
    const aliases = new Set(PROVIDER_ALIASES.keys());
    return [...this.entries.entries()].filter(([id]) => !aliases.has(id)).map(([, entry]) => entry);
  }

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
