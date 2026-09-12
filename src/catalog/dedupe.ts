import type { ProviderCatalogEntry } from "./types.js";

/**
 * Collapse duplicate catalog entries.
 *
 * The catalog grew by accretion, and the same endpoint ends up listed more than
 * once under two ids (for example `aion` and `aion-labs`) or twice under one id
 * with different amounts of detail. Two entries that share an id, or share a
 * base URL, describe one service and must behave like one.
 *
 * Merging keeps the richest description of each field rather than the last one
 * seen, so a duplicate that was added later with an empty `knownModels` list can
 * no longer silently erase the curated model list of the entry it duplicates.
 */
export function mergeProviderEntries(entries: ProviderCatalogEntry[]): ProviderCatalogEntry[] {
  const byKey = new Map<string, ProviderCatalogEntry>();
  /** base URL to the canonical key that owns it. */
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

/**
 * Map every id in the raw catalog onto the id of the entry that survived the
 * merge.
 *
 * Deduplication must never orphan a stored reference: chains on disk carry a
 * provider id, and collapsing `aion-labs` into `aion` is only safe if
 * `aion-labs` still resolves afterwards. Only ids that actually changed are
 * present, so an unaffected catalog produces an empty map.
 */
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
  return url.replace(/\/+$/, "");
}

function mergeEntry(a: ProviderCatalogEntry, b: ProviderCatalogEntry): ProviderCatalogEntry {
  return {
    ...a,
    // Prefer a human name over an id-shaped fallback.
    displayName: prefer(a.displayName, b.displayName, a.id),
    baseUrl: a.baseUrl,
    signupUrl: prefer(a.signupUrl, b.signupUrl, ""),
    docsUrl: a.docsUrl ?? b.docsUrl,
    notes: a.notes ?? b.notes,
    extraHeaders: { ...(b.extraHeaders ?? {}), ...(a.extraHeaders ?? {}) },
    // Union so a sparse duplicate can only add models, never remove them.
    knownModels: [...new Set([...a.knownModels, ...b.knownModels])],
    credentialFields: [...new Set([...a.credentialFields, ...b.credentialFields])],
    freeTier: a.freeTier.advertised ? a.freeTier : b.freeTier,
    verification: a.verification.method === "chat" ? a.verification : b.verification,
  };
}

/** Return `value` unless it is empty, in which case try the fallback. */
function prefer(value: string | undefined, fallback: string | undefined, otherwise: string): string {
  if (value && value.trim()) return value;
  if (fallback && fallback.trim()) return fallback;
  return otherwise;
}

/**
 * Collapse duplicate model rows, keeping the first occurrence.
 *
 * Two rows for one model id are the same model; the first is the curated one.
 */
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
