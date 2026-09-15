import { modelsForProvider, type ModelSpec } from "../../catalog/models.js";
import type { ProviderCatalogEntry } from "../../catalog/types.js";
import type { ProviderModelRecord } from "../db/provider-models.repo.js";

export interface SelectableModel extends ModelSpec {
  providerId: string;
  selectable: boolean;

  curated: boolean;

  live: boolean;

  firstSeenAt?: number;

  lastSeenAt?: number;
}

export interface ModelCatalogView {
  providerId: string;
  displayName: string;
  baseUrl: string;
  apiStyle: string;
  signupUrl: string;
  docsUrl?: string;
  freeTier: ProviderCatalogEntry["freeTier"];

  available: boolean;
  credentialCount: number;
  healthyCount: number;

  credentialIds: string[];

  staleModels: string[];

  inventoryCheckedAt?: number;
  counts: {
    curated: number;

    live: number;

    discovered: number;
  };
  models: SelectableModel[];
}

export function staleCuratedModels(
  curated: readonly string[],
  observed: readonly ProviderModelRecord[],
): string[] {
  if (observed.length === 0) return [];
  const live = new Set(observed.filter((record) => record.available).map((record) => record.model));
  return curated.filter((model) => !live.has(model));
}

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

      models: models.map((model) => ({ ...model, selectable: available })),
    });
  }

  return views.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
}
