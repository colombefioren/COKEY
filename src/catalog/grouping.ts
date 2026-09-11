import type { ProviderCatalogEntry, ProviderStatus } from "./types.js";

/**
 * Split a provider list into the two sections the UI and CLI present:
 * providers that explicitly advertise a free tier, and everything else.
 *
 * The split is data-driven — it reads `freeTier.advertised` and never infers
 * freeness from trial credits or pricing pages.
 */
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
