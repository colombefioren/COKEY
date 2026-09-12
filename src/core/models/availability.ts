import { modelsForProvider, type ModelSpec } from "../../catalog/models.js";
import type { ProviderCatalogEntry } from "../../catalog/types.js";

/** A curated model plus whether the user can actually select it right now. */
export interface SelectableModel extends ModelSpec {
  providerId: string;
  /**
   * True only when the provider has at least one credential COKEY has verified
   * against the provider itself.
   *
   * The UI renders a non-selectable model greyed out with a "connect a key"
   * hint instead of letting the user build a chain that cannot run.
   */
  selectable: boolean;
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
  models: SelectableModel[];
}

/**
 * Join the static free-model catalog with the user's live credential state.
 *
 * `counts` is total/healthy per provider; `working` holds the ids of healthy
 * credentials per provider.
 */
export function modelAvailability(
  catalog: ProviderCatalogEntry[],
  counts: Map<string, { total: number; healthy: number }>,
  working: Map<string, string[]>,
): ModelCatalogView[] {
  const views: ModelCatalogView[] = [];

  for (const entry of catalog) {
    const models = modelsForProvider(entry.id);
    // A provider with nothing curated is not usable, so it never becomes a card
    // the picker can offer.
    if (models.length === 0) continue;


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
      models: models.map((model) => ({
        ...model,
        providerId: entry.id,
        selectable: available,
      })),
    });
  }

  // Providers the user can use first, then the rest — both alphabetically.
  return views.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
}
