import type { ProviderModelRecord } from "../db/provider-models.repo.js";

/**
 * Reconciling what a provider says it serves against what COKEY believed.
 *
 * This module is deliberately free of I/O. The network call and the database
 * write live in `Cokey.refreshProviderModels`; everything that decides *what
 * changed* is a pure function here, which is what makes the interesting rules —
 * which models count as retired, when a missing model is forgotten rather than
 * remembered, why an empty response must not be trusted — testable without a
 * provider, a socket or a clock.
 */

/** How long a model that stopped being returned is remembered before forgetting. */
export const RETAIN_MISSING_MS = 14 * 24 * 60 * 60 * 1000;

/** What changed between the inventory we had and the one the provider just gave. */
export interface ModelChangeSet {
  /** Models present after this check that were not known before. */
  added: string[];
  /** Models that were marked unavailable and are back. */
  restored: string[];
  /** Models returned last time and not this time. */
  removed: string[];
  /** Missing models old enough to forget entirely. */
  pruned: number;
  /**
   * Curated models the provider did not return.
   *
   * A curated model can be listed in this report even though no inventory row
   * exists for it: a model that was never observed and is no longer offered is
   * just as absent as one that was observed and vanished.
   */
  stale: string[];
  /** Returned models that are not in the shipped curated list. */
  uncurated: string[];
  /** Records that were already available and still are. */
  unchanged: number;
}

export interface ReconcileInput {
  providerId: string;
  /** The hand-curated model list shipped with COKEY for this provider. */
  curated: string[];
  /** Model ids the provider returned just now. */
  discovered: string[];
  /** The inventory as stored before this check. */
  previous: ProviderModelRecord[];
  /** Timestamp to stamp this check with. Injected so tests need no clock. */
  now: number;
  /** Override for the retention window, primarily for tests. */
  retainMissingMs?: number;
}

export interface ReconcileResult {
  /** The complete inventory to store, replacing what was there. */
  records: ProviderModelRecord[];
  changes: ModelChangeSet;
}

export interface ModelDiscoveryReport extends ModelChangeSet {
  providerId: string;
  displayName: string;
  ok: boolean;
  /** Why the check could not be trusted, when `ok` is false. */
  message?: string;
  latencyMs: number;
  checkedAt: number;
  /** How many models the provider returned. */
  discovered: number;
  /** How many rows the provider's inventory holds after this check. */
  tracked: number;
}

/**
 * Normalise a model id list: trimmed, non-empty, de-duplicated, order kept.
 *
 * Order is preserved because several providers return their list
 * oldest-popular-first, and keeping it means the UI does not reshuffle itself
 * between two checks that found the same models.
 */
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

/**
 * Decide the inventory that should be stored, and what changed.
 *
 * The rules that matter, and why:
 *
 *   - A model the provider returned is available. If it had been marked
 *     unavailable, that is a `restored` change — a provider un-retiring a model
 *     is common enough to name.
 *   - A model that was available and was not returned is `removed`, but it is
 *     kept with `available: false` until it has been missing for the retention
 *     window. Providers flicker: a model can vanish from the listing for an hour
 *     during a rollout. Forgetting immediately would make the UI flap, and would
 *     also lose the ability to say "this came back".
 *   - Curated models are reported as `stale` rather than deleted, so the UI can
 *     explain a disappearance instead of silently shrinking the list.
 *   - `firstSeen` survives every reconciliation. It is the only field that can
 *     answer "when did this model first appear on this provider", which is worth
 *     having and costs nothing to keep.
 */
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

  // ---- what the provider returned ----------------------------------------
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
      // A curated model stays curated even if the catalog list changed; the
      // label is about provenance, not about the current catalog revision.
      curated: isCurated || previous.curated,
      available: true,
      lastSeen: now,
      lastChecked: now,
    });
  }

  // ---- what was known and was not returned --------------------------------
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

  // ---- the curated list, judged against reality ---------------------------
  for (const model of curated) {
    if (!discoveredSet.has(model)) changes.stale.push(model);
  }

  return { records, changes };
}

/**
 * Whether a model listing result can be trusted enough to store.
 *
 * An empty listing is treated as a failed check, not as "this provider now
 * serves nothing". Several gateways answer `/models` with an empty array when a
 * key is valid but under-scoped, during a deploy, or behind a cached edge node.
 * Treating that as truth would wipe a working provider off the dashboard and
 * detach its models from every chain that uses them — a catastrophic outcome
 * from a misleadingly successful HTTP 200.
 */
export function isTrustworthyListing(discovered: readonly string[]): boolean {
  return discovered.length > 0;
}
