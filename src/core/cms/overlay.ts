import {
  providerDossier,
  type ProviderDossier,
  type ProviderKind,
  type ProviderVerdict,
} from "../../catalog/dossiers.js";
import {
  COMBINED_RANKING,
  DROP_LIST,
  RANKING_BOTTOM_LINE,
  RANKING_DISCLAIMER,
  RANKING_SOURCES,
  RATE_LIMIT_RANKING,
  REDUNDANCY_TABLE,
  SKILL_RANKING,
  SKILL_TIERS,
  type CombinedEntry,
  type RateLimitEntry,
  type RedundancyEntry,
  type SkillEntry,
  type SkillTier,
} from "../../catalog/rankings.js";
import type { CmsModel, CmsProvider, CmsSnapshot } from "./load.js";

/**
 * Overlaying content over the compiled-in catalog.
 *
 * COKEY ships with a curated catalog baked in, and that is on purpose: a fresh
 * clone must show a useful dashboard with no network and no content checkout.
 * The content repository then *overrides* it, field by field, so an editor can
 * correct one verdict without having to reproduce the rest of the catalog.
 *
 * The direction of the merge is the important part. Content wins where it
 * speaks, and the compiled-in value fills every gap — a CMS dossier that only
 * states a verdict still gets its summary, operator and source URL from the
 * build. That keeps a partially-filled dossier useful rather than destructive.
 */

/** A dossier plus the provenance a reader needs to weigh it. */
export interface CuratedDossier extends ProviderDossier {
  /** `cms` when the content repository supplied this entry. */
  source: "cms" | "compiled";
  /** ISO date a human last checked the claims, when the CMS records one. */
  reviewedAt?: string;
  /** One-line free-tier summary, when the CMS records one. */
  freeTierSummary?: string;
  /** The editor's caveat, when there is one. */
  notes?: string;
  /**
   * Free model list as curated in the CMS.
   *
   * Undefined means "the content repository has nothing to say", which is
   * different from an empty list — the latter is an editor stating that there
   * are no free models, and the provider picker hides it.
   */
  models?: CmsModel[];
}

/**
 * Merge one provider's dossier with the content repository's version.
 *
 * Unknown ids fall back to the compiled catalog and finally to the neutral
 * "nobody has verified this" dossier, so the caller always gets something it can
 * render.
 */
export function curateProvider(providerId: string, snapshot?: CmsSnapshot): CuratedDossier {
  const base = providerDossier(providerId);
  const cms = snapshot?.providers.get(providerId);
  if (!cms) return { ...base, source: "compiled" };

  return {
    operator: cms.operator ?? base.operator,
    origin: cms.origin ?? base.origin,
    kind: cms.kind ?? base.kind,
    summary: cms.summary ?? base.summary,
    verdict: cms.verdict ?? base.verdict,
    verdictReason: cms.verdictReason ?? base.verdictReason,
    sourceUrl: cms.sourceUrl ?? base.sourceUrl,
    source: "cms",
    reviewedAt: cms.reviewedAt,
    freeTierSummary: cms.freeTier?.summary,
    notes: cms.notes,
    models: cms.models,
  };
}

/**
 * Every provider the content repository documents, curated.
 *
 * Used by the catalog screen so a provider that exists in the CMS but not in
 * the compiled catalog still appears — the CMS is allowed to lead the code.
 */
export function curatedProviders(snapshot?: CmsSnapshot): Map<string, CuratedDossier> {
  const out = new Map<string, CuratedDossier>();
  if (!snapshot) return out;
  for (const id of snapshot.providers.keys()) out.set(id, curateProvider(id, snapshot));
  return out;
}

/** The ranking boards, in the shape `/api/catalog/rankings` returns. */
export interface RankingsView {
  tiers: SkillTier[];
  skill: SkillEntry[];
  rateLimit: RateLimitEntry[];
  combined: CombinedEntry[];
  redundancy: RedundancyEntry[];
  dropList: Array<{ provider: string; reason: string }>;
  bottomLine: string;
  disclaimer: string;
  sources: Array<{ label: string; url: string }>;
  /** Where the boards came from, so the UI can say so honestly. */
  source: "cms" | "compiled";
  /** ISO date of the newest review behind a board, when the CMS records one. */
  reviewedAt?: string;
  /** How many entries the compiled-in boards were overruled on. */
  counts: { skill: number; rateLimit: number; combined: number };
}

/**
 * Pick the ranking boards to serve.
 *
 * The content repository's boards replace the compiled ones wholesale rather
 * than merging entry by entry. A ranking is an ordering, and merging two
 * orderings produces a third that neither editor wrote — the one thing a
 * ranked list must never be.
 */
export function rankingsView(snapshot?: CmsSnapshot): RankingsView {
  const cms = snapshot?.rankings;
  if (!cms) {
    return {
      tiers: SKILL_TIERS,
      skill: SKILL_RANKING,
      rateLimit: RATE_LIMIT_RANKING,
      combined: COMBINED_RANKING,
      redundancy: REDUNDANCY_TABLE,
      dropList: DROP_LIST,
      bottomLine: RANKING_BOTTOM_LINE,
      disclaimer: RANKING_DISCLAIMER,
      sources: RANKING_SOURCES,
      source: "compiled",
      counts: {
        skill: SKILL_RANKING.length,
        rateLimit: RATE_LIMIT_RANKING.length,
        combined: COMBINED_RANKING.length,
      },
    };
  }

  return {
    tiers: cms.tiers.length > 0 ? cms.tiers : SKILL_TIERS,
    skill: cms.skill,
    rateLimit: cms.rateLimit,
    combined: cms.combined,
    redundancy: cms.redundancy,
    dropList: cms.dropList,
    bottomLine: cms.bottomLine,
    disclaimer: cms.disclaimer,
    sources: cms.sources.length > 0 ? cms.sources : RANKING_SOURCES,
    source: "cms",
    reviewedAt: newestReview(snapshot),
    counts: {
      skill: cms.skill.length,
      rateLimit: cms.rateLimit.length,
      combined: cms.combined.length,
    },
  };
}

/** The most recent `reviewedAt` across the content repository, or undefined. */
export function newestReview(snapshot?: CmsSnapshot): string | undefined {
  if (!snapshot) return undefined;
  let newest: string | undefined;
  for (const provider of snapshot.providers.values()) {
    const date = provider.reviewedAt;
    if (!date) continue;
    if (!newest || date > newest) newest = date;
  }
  return newest;
}

/**
 * Providers in the content repository that the compiled catalog does not know.
 *
 * Surfaced rather than hidden: it usually means a provider was added to the
 * content repo and COKEY has not been updated to talk to it, which is a
 * five-minute fix that is invisible otherwise.
 */
export function undocumentedProviders(snapshot?: CmsSnapshot): string[] {
  if (!snapshot) return [];
  const out: string[] = [];
  for (const id of snapshot.providers.keys()) {
    if (id.startsWith("custom:")) continue;
    const dossier = providerDossier(id);
    // A neutral dossier is the compiled catalog saying it has never heard of it.
    if (dossier.operator === "Not publicly disclosed") out.push(id);
  }
  return out.sort();
}

/** Re-exported for the routes and the UI types, so nothing else reaches into two modules. */
export type { ProviderKind, ProviderVerdict, CmsProvider };
