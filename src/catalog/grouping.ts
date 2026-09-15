import type { ProviderCatalogEntry, ProviderStatus } from "./types.js";

export function divideFreeProviders<T extends ProviderCatalogEntry | ProviderStatus>(
  providers: T[],
): { free: T[]; other: T[] } {
  const free: T[] = [];
  const other: T[] = [];
  for (const provider of providers) {
    if (provider.freeTier.advertised) free.push(provider);
    else other.push(provider);
  }
  return { free, other };
}
