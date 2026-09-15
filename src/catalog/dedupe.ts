import type { ProviderCatalogEntry } from "./types.js";

export function mergeProviderEntries(entries: ProviderCatalogEntry[]): ProviderCatalogEntry[] {
  const byKey = new Map<string, ProviderCatalogEntry>();

  const urlToKey = new Map<string, string>();

  for (const entry of entries) {
    const normalizedUrl = normalizeUrl(entry.baseUrl);
    const key = byKey.has(entry.id) ? entry.id : (urlToKey.get(normalizedUrl) ?? entry.id);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, { ...entry, knownModels: [...entry.knownModels] });
      urlToKey.set(normalizedUrl, key);
      continue;
    }

    byKey.set(key, mergeEntry(existing, entry));
    urlToKey.set(normalizedUrl, key);
  }

  return [...byKey.values()];
}

export function catalogAliases(
  entries: ProviderCatalogEntry[],
  merged: ProviderCatalogEntry[],
): Map<string, string> {
  const byId = new Map(merged.map((entry) => [entry.id, entry]));
  const byUrl = new Map(merged.map((entry) => [normalizeUrl(entry.baseUrl), entry]));

  const aliases = new Map<string, string>();
  for (const entry of entries) {
    const survivor = byId.get(entry.id) ?? byUrl.get(normalizeUrl(entry.baseUrl));
    if (survivor && survivor.id !== entry.id) aliases.set(entry.id, survivor.id);
  }
  return aliases;
}

function normalizeUrl(url: string): string {
  let end = url.length;
  while (end > 0 && url.charCodeAt(end - 1) === 47) end--;
  return url.slice(0, end);
}

function mergeEntry(a: ProviderCatalogEntry, b: ProviderCatalogEntry): ProviderCatalogEntry {
  return {
    ...a,

    displayName: prefer(a.displayName, b.displayName, a.id),
    baseUrl: a.baseUrl,
    signupUrl: prefer(a.signupUrl, b.signupUrl, ""),
    docsUrl: a.docsUrl ?? b.docsUrl,
    notes: a.notes ?? b.notes,
    extraHeaders: { ...(b.extraHeaders ?? {}), ...(a.extraHeaders ?? {}) },

    knownModels: [...new Set([...a.knownModels, ...b.knownModels])],
    credentialFields: [...new Set([...a.credentialFields, ...b.credentialFields])],
    freeTier: a.freeTier.advertised ? a.freeTier : b.freeTier,
    verification: a.verification.method === "chat" ? a.verification : b.verification,
  };
}

function prefer(
  value: string | undefined,
  fallback: string | undefined,
  otherwise: string,
): string {
  if (value && value.trim()) return value;
  if (fallback && fallback.trim()) return fallback;
  return otherwise;
}

export function dedupeModels<T extends { id: string }>(models: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const model of models) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    out.push(model);
  }
  return out;
}
