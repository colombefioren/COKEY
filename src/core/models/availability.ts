import { modelsForProvider, type ModelSpec } from "../../catalog/models.js";
import type { ProviderCatalogEntry } from "../../catalog/types.js";
import type { ProviderModelRecord } from "../db/provider-models.repo.js";

/**
 * A model the user might pick, with everything needed to decide whether they
 * should be allowed to.
 *
 * Three independent questions, deliberately kept as three fields rather than
 * collapsed into one:
 *
 *   `live`        does the provider still serve it? (observed, from the
 *                 provider's own model listing)
 *   `curated`     is it in COKEY's hand-written free-model list? (annotated,
 *                 with a context window and a best-use note)
 *   `selectable`  should the picker allow it right now? (true only when the
 *                 provider holds a key COKEY has verified, so a chain can never
 *                 be built against a key that does not work)
 */
export interface SelectableModel extends ModelSpec {
  providerId: string;
  selectable: boolean;
  /** True when the shipped catalog lists this model. */
  curated: boolean;
  /**
   * True when the provider still serves it.
   *
   * A provider that has never been checked has no inventory, and nothing
   * contradicts the catalog, so this is true. `inventoryCheckedAt` on the
   * provider view is what distinguishes "observed live" from "assumed live".
   */
  live: boolean;
  /** When the provider first returned this model, once it has been observed. */
  firstSeenAt?: number;
  /** When the provider last returned it. */
  lastSeenAt?: number;
}

/** A provider together with its models and the user's connection state. */
export interface ModelCatalogView {
  providerId: string;
  displayName: string;
  baseUrl: string;
  apiStyle: string;
  signupUrl: string;
  docsUrl?: string;
  freeTier: ProviderCatalogEntry["freeTier"];
  /** True when at least one healthy credential exists for this provider. */
  available: boolean;
  credentialCount: number;
  healthyCount: number;
  /** Ids of healthy credentials, so the UI can wire a pick straight into a chain. */
  credentialIds: string[];
  /**
   * Curated models the provider did not return the last time it was asked.
   *
   * These are withheld from `models` so the picker cannot offer a model the
   * provider has retired, but they are reported here so the dashboard can say
   * what disappeared instead of quietly listing one fewer row.
   */
  staleModels: string[];
  /** When the inventory was last refreshed. Absent means never checked. */
  inventoryCheckedAt?: number;
  counts: {
    /** Models in the shipped catalog for this provider. */
    curated: number;
    /** Curated models the provider still returns. */
    live: number;
    /** Models the provider returns that the catalog does not list. */
    discovered: number;
  };
  models: SelectableModel[];
}

/**
 * Curated models a provider no longer returns.
 *
 * Returns an empty list when the provider has never been checked, because
 * "never asked" and "asked and gone" are different answers and conflating them
 * would mark an entire catalog as retired the first time a provider is seen.
 */
export function staleCuratedModels(
  curated: readonly string[],
  observed: readonly ProviderModelRecord[],
): string[] {
  if (observed.length === 0) return [];
  const live = new Set(observed.filter((record) => record.available).map((record) => record.model));
  return curated.filter((model) => !live.has(model));
}

/**
 * Join the curated catalog with the user's credentials and the observed
 * inventory.
 *
 * `counts` is total/healthy credentials per provider, `working` holds the ids of
 * healthy credentials, and `inventory` is the last observed model list per
 * provider (absent for a provider that has never been asked).
 *
 * A provider with no models at all — curated or discovered — never becomes a
 * card, because there would be nothing to add to a chain.
 */
export function modelAvailability(
  catalog: ProviderCatalogEntry[],
  counts: Map<string, { total: number; healthy: number }>,
  working: Map<string, string[]>,
  inventory: Map<string, ProviderModelRecord[]> = new Map(),
): ModelCatalogView[] {
  const views: ModelCatalogView[] = [];

  for (const entry of catalog) {
    const observed = inventory.get(entry.id) ?? [];
    const byModel = new Map(observed.map((record) => [record.model, record]));
    const checked = observed.length > 0;

    const curatedSpecs = modelsForProvider(entry.id);
    const staleModels = new Set(
      staleCuratedModels(
        curatedSpecs.map((spec) => spec.id),
        observed,
      ),
    );
    const models: SelectableModel[] = [];

    // Curated models first, in catalog order, minus anything the provider has
    // stopped serving.
    for (const spec of curatedSpecs) {
      const record = byModel.get(spec.id);
      if (staleModels.has(spec.id)) continue;
      models.push({
        ...spec,
        providerId: entry.id,
        curated: true,
        live: true,
        firstSeenAt: record?.firstSeen,
        lastSeenAt: record?.lastSeen,
        selectable: false,
      });
    }

    // Then anything the provider serves that the catalog has not annotated,
    // alphabetically so the order is stable between checks.
    const curatedIds = new Set(curatedSpecs.map((spec) => spec.id));
    const extras = observed
      .filter((record) => record.available && !curatedIds.has(record.model))
      .map((record) => record.model)
      .sort((a, b) => a.localeCompare(b));

    for (const model of extras) {
      const record = byModel.get(model);
      models.push({
        id: model,
        providerId: entry.id,
        curated: false,
        live: true,
        firstSeenAt: record?.firstSeen,
        lastSeenAt: record?.lastSeen,
        selectable: false,
      });
    }

    if (models.length === 0 && staleModels.size === 0) continue;

    const credentialIds = working.get(entry.id) ?? [];
    const available = credentialIds.length > 0;
    const count = counts.get(entry.id);

    views.push({
      providerId: entry.id,
      displayName: entry.displayName,
      baseUrl: entry.baseUrl,
      apiStyle: entry.apiStyle,
      signupUrl: entry.signupUrl,
      docsUrl: entry.docsUrl,
      freeTier: entry.freeTier,
      available,
      credentialCount: count?.total ?? 0,
      healthyCount: count?.healthy ?? 0,
      credentialIds,
      staleModels: [...staleModels],
      inventoryCheckedAt: checked ? observed[0]!.lastChecked : undefined,
      counts: {
        curated: curatedSpecs.length,
        live: models.filter((model) => model.curated).length,
        discovered: extras.length,
      },
      // A model is only pickable when its provider holds a verified key.
      models: models.map((model) => ({ ...model, selectable: available })),
    });
  }

  // Providers the user can use first, then the rest — both alphabetically.
  return views.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
}
