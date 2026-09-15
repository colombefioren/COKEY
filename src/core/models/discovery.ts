import type { ProviderModelRecord } from "../db/provider-models.repo.js";

export const RETAIN_MISSING_MS = 14 * 24 * 60 * 60 * 1000;

export function eligibleModels<T extends { free?: boolean }>(
  listing: readonly T[],
  freeModelsOnly: boolean | undefined,
): T[] {
  return freeModelsOnly ? listing.filter((model) => model.free !== false) : [...listing];
}

export interface ModelChangeSet {
  added: string[];

  restored: string[];

  removed: string[];

  pruned: number;

  stale: string[];

  uncurated: string[];

  unchanged: number;
}

export interface ReconcileInput {
  providerId: string;

  curated: string[];

  discovered: string[];

  previous: ProviderModelRecord[];

  now: number;

  retainMissingMs?: number;
}

export interface ReconcileResult {
  records: ProviderModelRecord[];
  changes: ModelChangeSet;
}

export interface ModelDiscoveryReport extends ModelChangeSet {
  providerId: string;
  displayName: string;
  ok: boolean;

  message?: string;
  latencyMs: number;
  checkedAt: number;

  discovered: number;

  tracked: number;
}

export function normaliseModelIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function reconcileModels(input: ReconcileInput): ReconcileResult {
  const { providerId, now } = input;
  const retainMissingMs = input.retainMissingMs ?? RETAIN_MISSING_MS;

  const discovered = normaliseModelIds(input.discovered);
  const curated = normaliseModelIds(input.curated);
  const curatedSet = new Set(curated);
  const discoveredSet = new Set(discovered);
  const previousByModel = new Map(input.previous.map((record) => [record.model, record]));

  const records: ProviderModelRecord[] = [];
  const changes: ModelChangeSet = {
    added: [],
    restored: [],
    removed: [],
    pruned: 0,
    stale: [],
    uncurated: [],
    unchanged: 0,
  };

  for (const model of discovered) {
    const isCurated = curatedSet.has(model);
    const previous = previousByModel.get(model);

    if (!previous) {
      records.push({
        providerId,
        model,
        curated: isCurated,
        available: true,
        firstSeen: now,
        lastSeen: now,
        lastChecked: now,
      });
      changes.added.push(model);
      if (!isCurated) changes.uncurated.push(model);
      continue;
    }

    if (!previous.available) {
      changes.restored.push(model);
    } else {
      changes.unchanged += 1;
    }

    records.push({
      ...previous,

      curated: isCurated || previous.curated,
      available: true,
      lastSeen: now,
      lastChecked: now,
    });
  }

  for (const previous of input.previous) {
    if (discoveredSet.has(previous.model)) continue;

    if (previous.available) changes.removed.push(previous.model);

    const missingFor = now - previous.lastSeen;
    if (missingFor > retainMissingMs) {
      changes.pruned += 1;
      continue;
    }

    records.push({ ...previous, available: false, lastChecked: now });
  }

  for (const model of curated) {
    if (!discoveredSet.has(model)) changes.stale.push(model);
  }

  return { records, changes };
}

export function isTrustworthyListing(discovered: readonly string[]): boolean {
  return discovered.length > 0;
}
