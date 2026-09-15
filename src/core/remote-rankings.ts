import { z } from "zod";
import type { RankingsView } from "../catalog/rankings.js";

const RankingSourceSchema = z.object({ label: z.string(), url: z.string() });

const RankingsMetaSchema = z.object({
  lastResearched: z.string(),
  methodology: z.string(),
  methodologyFr: z.string().optional(),
});

const WorthTryingEntrySchema = z.object({
  provider: z.string(),
  note: z.string(),
  noteFr: z.string().optional(),
});

const SkillTierSchema = z.object({
  name: z.enum(["S", "A", "B", "C"]),
  label: z.string(),
  labelFr: z.string().optional(),
  blurb: z.string(),
  blurbFr: z.string().optional(),
});

const SkillEntrySchema = z.object({
  model: z.string(),
  providerId: z.string().optional(),
  tierName: z.enum(["S", "A", "B", "C"]),
  sweScore: z.number().optional(),
  reason: z.string(),
  reasonFr: z.string().optional(),
});

const RateLimitEntrySchema = z.object({
  providerId: z.string(),
  provider: z.string(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  quota: z.string(),
  provenance: z.enum(["operator", "third-party", "unpublished"]),
  reliability: z.enum(["solid", "watch", "avoid"]),
  fieldTested: z.boolean().optional(),
  note: z.string().optional(),
  noteFr: z.string().optional(),
});

const CombinedEntrySchema = z.object({
  rank: z.number(),
  providerId: z.string(),
  model: z.string(),
  why: z.string(),
  whyFr: z.string().optional(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

const RedundancyEntrySchema = z.object({
  family: z.string(),
  alsoOn: z.array(z.string()),
  keep: z.string(),
  fallback: z.string(),
  note: z.string().optional(),
  noteFr: z.string().optional(),
});

const RankingsBundleSchema = z.object({
  meta: RankingsMetaSchema.optional(),
  tiers: z.array(SkillTierSchema).min(1),
  skill: z.array(SkillEntrySchema),
  rateLimit: z.array(RateLimitEntrySchema),
  combined: z.array(CombinedEntrySchema),
  redundancy: z.array(RedundancyEntrySchema),
  dropList: z.array(
    z.object({ provider: z.string(), reason: z.string(), reasonFr: z.string().optional() }),
  ),
  worthTryingWithCaveats: z.array(WorthTryingEntrySchema).optional(),
  bottomLine: z.string(),
  bottomLineFr: z.string().optional(),
  disclaimer: z.string(),
  disclaimerFr: z.string().optional(),
  sources: z.array(RankingSourceSchema),
  funFacts: z.array(z.string()).optional(),
  funFactsFr: z.array(z.string()).optional(),
});

export type RankingsFetchResult =
  { ok: true; rankings: RankingsView } | { ok: false; message: string };

const FETCH_TIMEOUT_MS = 8_000;

const MAX_BYTES = 2 * 1024 * 1024;

export async function fetchRemoteRankings(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<RankingsFetchResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ok: false, message: `Not a valid URL: ${url}` };
  }
  if (parsedUrl.protocol !== "https:") {
    return { ok: false, message: "Only https:// sources are allowed." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(parsedUrl, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return { ok: false, message: `${parsedUrl.host} answered HTTP ${response.status}` };
    }
    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      return { ok: false, message: "Response is too large to be a ranking bundle." };
    }
    const text = await response.text();
    if (text.length > MAX_BYTES) {
      return { ok: false, message: "Response is too large to be a ranking bundle." };
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch (error) {
      return { ok: false, message: `Not valid JSON: ${(error as Error).message}` };
    }

    const parsed = RankingsBundleSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return {
        ok: false,
        message: first
          ? `${first.path.join(".") || "(root)"}: ${first.message}`
          : "Malformed bundle.",
      };
    }

    return {
      ok: true,
      rankings: { ...parsed.data, source: "remote", fetchedAt: new Date().toISOString() },
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Timed out waiting for a response."
        : error instanceof Error
          ? error.message
          : String(error);
    return { ok: false, message };
  } finally {
    clearTimeout(timer);
  }
}
