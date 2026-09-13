import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ProviderKind, ProviderVerdict } from "../../catalog/dossiers.js";
import type {
  CombinedEntry,
  RateLimitEntry,
  RedundancyEntry,
  SkillEntry,
  SkillTier,
} from "../../catalog/rankings.js";

/**
 * Reading the content repository.
 *
 * The curated catalog — who runs a provider, whether their free tier is
 * infrastructure or a demo, what the rankings say — lives in a separate Git
 * repository so that content can change on a faster cadence than code, and so
 * that editing a dossier never means shipping a binary.
 *
 * That separation buys a hard requirement: this loader may not throw. The
 * content directory is user-editable and may be absent, half-written, or
 * mid-`git checkout`. A malformed JSON file must cost exactly one provider, not
 * a broken dashboard. So every failure becomes an entry in `issues` and every
 * reader downstream treats an empty snapshot as "fall back to what is compiled
 * in".
 */

/* -------------------------------------------------------------------------- *\
 * Shapes
\* -------------------------------------------------------------------------- */

export interface CmsModel {
  id: string;
  /** Advertised context window, as a display string (e.g. "262K"). */
  context?: string;
  bestFor?: string;
  latencySeconds?: number;
}

export interface CmsFreeTier {
  advertised: boolean;
  summary: string;
  /** `unknown` is a legitimate answer; it means the operator publishes nothing. */
  quotaSource: "provider" | "unknown";
}

/**
 * A provider dossier as the content repository stores it.
 *
 * Every field is optional except the identity ones because this is a *tolerant*
 * view of a file a human typed. The store fills what is missing with a neutral
 * default rather than rejecting the entry, so a dossier that is half-finished
 * still improves on having nothing at all.
 */
export interface CmsProvider {
  id: string;
  displayName?: string;
  operator?: string;
  origin?: string;
  kind?: ProviderKind;
  summary?: string;
  verdict?: ProviderVerdict;
  verdictReason?: string;
  sourceUrl?: string;
  /** ISO date a human last checked the claims. */
  reviewedAt?: string;
  baseUrl?: string;
  apiStyle?: string;
  authScheme?: string;
  signupUrl?: string;
  docsUrl?: string;
  freeTier?: CmsFreeTier;
  notes?: string;
  models: CmsModel[];
}

export interface CmsTermsSection {
  slug: string;
  title: string;
  order: number;
  updatedAt: string;
  body: string;
}

export interface CmsRankings {
  tiers: SkillTier[];
  skill: SkillEntry[];
  rateLimit: RateLimitEntry[];
  combined: CombinedEntry[];
  redundancy: RedundancyEntry[];
  dropList: Array<{ provider: string; reason: string }>;
  bottomLine: string;
  disclaimer: string;
  sources: Array<{ label: string; url: string }>;
}

export interface CmsIssue {
  /** Path relative to the content directory. */
  file: string;
  message: string;
}

export interface CmsSnapshot {
  /** Absolute path of the content directory that was read. */
  directory: string;
  /** When the snapshot was taken. */
  loadedAt: number;
  providers: Map<string, CmsProvider>;
  terms: CmsTermsSection[];
  rankings?: CmsRankings;
  issues: CmsIssue[];
}

/* -------------------------------------------------------------------------- *\
 * Locating the content directory
\* -------------------------------------------------------------------------- */

/** Candidate locations, in the order they are tried. */
export function cmsDirectoryCandidates(env: NodeJS.ProcessEnv, cwd = process.cwd()): string[] {
  const configured = env.COKEY_CMS_DIR?.trim();
  const candidates: string[] = [];
  if (configured) candidates.push(resolve(cwd, configured));
  candidates.push(join(cwd, "cms", "content"));
  candidates.push(join(cwd, "..", "COKEY--CMS", "content"));
  candidates.push(join(cwd, "..", "cokey-cms", "content"));
  return candidates;
}

/**
 * The content directory to read, or the first candidate when none exists.
 *
 * Returning a non-existent path rather than `undefined` keeps the caller from
 * having to special-case "not configured" everywhere: the loader simply reports
 * zero providers and one issue naming the directory it looked in.
 */
export function resolveCmsDirectory(env: NodeJS.ProcessEnv, cwd = process.cwd()): string {
  const candidates = cmsDirectoryCandidates(env, cwd);
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!;
}

/* -------------------------------------------------------------------------- *\
 * Loading
\* -------------------------------------------------------------------------- */

const PROVIDER_KINDS = new Set<ProviderKind>([
  "lab",
  "inference-cloud",
  "aggregator",
  "gateway",
  "local",
]);

const VERDICTS = new Set<ProviderVerdict>(["recommended", "usable", "limited", "avoid"]);

/**
 * Read the whole content tree into a snapshot.
 *
 * Synchronous on purpose: it runs once at start-up, and the handful of
 * milliseconds it costs is worth not making every caller of a content read
 * async.
 */
export function loadCmsSnapshot(directory: string): CmsSnapshot {
  const issues: CmsIssue[] = [];
  const providers = new Map<string, CmsProvider>();
  const terms: CmsTermsSection[] = [];

  if (!existsSync(directory)) {
    return {
      directory,
      loadedAt: Date.now(),
      providers,
      terms,
      issues: [
        {
          file: ".",
          message: `content directory not found at ${directory} — edit COKEY_CMS_DIR to point at it`,
        },
      ],
    };
  }

  readProviders(directory, providers, issues);
  readTerms(directory, terms, issues);
  const rankings = readRankings(directory, issues);

  terms.sort((a, b) => a.order - b.order);

  return { directory, loadedAt: Date.now(), providers, terms, rankings, issues };
}

function readProviders(
  directory: string,
  providers: Map<string, CmsProvider>,
  issues: CmsIssue[],
): void {
  const dir = join(directory, "providers");
  if (!existsSync(dir)) return;

  for (const name of listFiles(dir, ".json")) {
    const file = join(dir, name);
    const id = name.replace(/\.json$/, "");
    const raw = readJson(file, `providers/${name}`, issues);
    if (raw === undefined) continue;
    if (!isRecord(raw)) {
      issues.push({ file: `providers/${name}`, message: "expected a JSON object" });
      continue;
    }
    providers.set(id, toProvider(id, raw, `providers/${name}`, issues));
  }
}

function toProvider(
  id: string,
  raw: Record<string, unknown>,
  file: string,
  issues: CmsIssue[],
): CmsProvider {
  const kind = str(raw.kind);
  const verdict = str(raw.verdict);

  if (kind && !PROVIDER_KINDS.has(kind as ProviderKind)) {
    issues.push({ file, message: `unknown kind "${kind}"` });
  }
  if (verdict && !VERDICTS.has(verdict as ProviderVerdict)) {
    issues.push({ file, message: `unknown verdict "${verdict}"` });
  }

  // A file whose name and `id` disagree is a renamed provider that left a stale
  // reference behind; naming the file it is in is the whole fix.
  const declaredId = str(raw.id);
  if (declaredId && declaredId !== id) {
    issues.push({ file, message: `declares id "${declaredId}" but is named "${id}.json"` });
  }

  return {
    id,
    displayName: str(raw.displayName),
    operator: str(raw.operator),
    origin: str(raw.origin),
    kind: PROVIDER_KINDS.has(kind as ProviderKind) ? (kind as ProviderKind) : undefined,
    summary: str(raw.summary),
    verdict: VERDICTS.has(verdict as ProviderVerdict) ? (verdict as ProviderVerdict) : undefined,
    verdictReason: str(raw.verdictReason),
    sourceUrl: str(raw.sourceUrl),
    reviewedAt: str(raw.reviewedAt),
    baseUrl: str(raw.baseUrl),
    apiStyle: str(raw.apiStyle),
    authScheme: str(raw.authScheme),
    signupUrl: str(raw.signupUrl),
    docsUrl: str(raw.docsUrl),
    freeTier: toFreeTier(raw.freeTier, file, issues),
    notes: str(raw.notes),
    models: toModels(raw.models, file, issues),
  };
}

function toFreeTier(raw: unknown, file: string, issues: CmsIssue[]): CmsFreeTier | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    issues.push({ file, message: "freeTier must be an object" });
    return undefined;
  }
  const summary = str(raw.summary);
  if (!summary) {
    issues.push({ file, message: "freeTier.summary is required when freeTier is present" });
    return undefined;
  }
  return {
    advertised: raw.advertised === true,
    summary,
    quotaSource: raw.quotaSource === "provider" ? "provider" : "unknown",
  };
}

function toModels(raw: unknown, file: string, issues: CmsIssue[]): CmsModel[] {
  if (!Array.isArray(raw)) {
    if (raw !== undefined) issues.push({ file, message: "models must be an array" });
    return [];
  }
  const models: CmsModel[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const id = str(entry.id);
    if (!id) {
      issues.push({ file, message: "a model entry has no id and was skipped" });
      continue;
    }
    models.push({
      id,
      context: str(entry.context),
      bestFor: str(entry.bestFor),
      latencySeconds: num(entry.latencySeconds),
    });
  }
  return models;
}

function readTerms(directory: string, terms: CmsTermsSection[], issues: CmsIssue[]): void {
  const dir = join(directory, "terms");
  if (!existsSync(dir)) return;

  const seenOrders = new Map<number, string>();

  for (const name of listFiles(dir, ".md")) {
    const file = `terms/${name}`;
    let text: string;
    try {
      text = readFileSync(join(dir, name), "utf8");
    } catch (error) {
      issues.push({ file, message: (error as Error).message });
      continue;
    }

    const { attributes, body } = parseFrontMatter(text);
    const title = attributes.title;
    const order = Number(attributes.order);

    if (!title) {
      issues.push({ file, message: "missing a title in its frontmatter" });
      continue;
    }
    if (!Number.isFinite(order)) {
      issues.push({ file, message: "missing a numeric order in its frontmatter" });
      continue;
    }
    if (body.trim().length === 0) {
      issues.push({ file, message: "has no body" });
      continue;
    }

    // Two sections claiming the same position render in an order that depends on
    // directory listing order, which is exactly the kind of bug nobody reports.
    const clash = seenOrders.get(order);
    if (clash) {
      issues.push({ file, message: `order ${order} is already used by ${clash}` });
      continue;
    }
    seenOrders.set(order, file);

    terms.push({
      slug: name.replace(/\.md$/, ""),
      title,
      order,
      updatedAt: attributes.updatedAt ?? "",
      body: body.trim(),
    });
  }
}

/* -------------------------------------------------------------------------- *\
 * Rankings
\* -------------------------------------------------------------------------- */

/**
 * Parse the ranking boards.
 *
 * `meta.json` is required for the boards to mean anything: a ranking with no
 * listed sources is an assertion, not a finding, and the disclaimer is what
 * stops a reader treating a benchmark score as a measurement of their own
 * traffic. Without it the boards are dropped and the compiled-in set is used.
 */
function readRankings(directory: string, issues: CmsIssue[]): CmsRankings | undefined {
  const dir = join(directory, "rankings");
  if (!existsSync(dir)) return undefined;

  /*
   * A rankings directory with no files in it is an empty checkout, not a
   * mistake — telling everyone their missing meta.json is a problem on a fresh
   * clone would make the issue list useless. Once there is at least one board,
   * the absence of meta.json *is* worth reporting.
   */
  if (listFiles(dir, ".json").length === 0) return undefined;

  const meta = readJson(join(dir, "meta.json"), "rankings/meta.json", issues);
  if (!isRecord(meta)) return undefined;

  const tiers = toArray(meta.tiers).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const name = str(entry.name);
    const label = str(entry.label);
    const blurb = str(entry.blurb);
    if (!name || !label || !blurb) return [];
    if (!["S", "A", "B", "C"].includes(name)) return [];
    return [{ name: name as SkillTier["name"], label, blurb }];
  });

  const disclaimer = str(meta.disclaimer);
  const bottomLine = str(meta.bottomLine);
  if (!disclaimer || !bottomLine || tiers.length === 0) {
    issues.push({
      file: "rankings/meta.json",
      message: "needs tiers, disclaimer and bottomLine — ranking boards are ignored without them",
    });
    return undefined;
  }

  const sources = toArray(meta.sources).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const label = str(entry.label);
    const url = str(entry.url);
    return label && url ? [{ label, url }] : [];
  });

  return {
    tiers,
    skill: readBoard<SkillEntry>(dir, "skill.json", issues, (entry) => {
      const model = str(entry.model);
      const tierName = str(entry.tierName);
      const reason = str(entry.reason);
      if (!model || !reason || !tierName) return undefined;
      if (!["S", "A", "B", "C"].includes(tierName)) return undefined;
      return {
        model,
        providerId: str(entry.providerId),
        tierName: tierName as SkillEntry["tierName"],
        sweScore: num(entry.sweScore),
        reason,
      };
    }),
    rateLimit: readBoard<RateLimitEntry>(dir, "rate-limits.json", issues, (entry) => {
      const providerId = str(entry.providerId);
      const provider = str(entry.provider);
      const tier = num(entry.tier);
      const quota = str(entry.quota);
      const provenance = str(entry.provenance);
      const reliability = str(entry.reliability);
      if (!providerId || !provider || !quota) return undefined;
      if (!tier || ![1, 2, 3, 4].includes(tier)) return undefined;
      if (!["operator", "third-party", "unpublished"].includes(provenance ?? "")) return undefined;
      if (!["solid", "watch", "avoid"].includes(reliability ?? "")) return undefined;
      return {
        providerId,
        provider,
        tier: tier as RateLimitEntry["tier"],
        quota,
        provenance: provenance as RateLimitEntry["provenance"],
        reliability: reliability as RateLimitEntry["reliability"],
        note: str(entry.note),
      };
    }),
    combined: readBoard<CombinedEntry>(dir, "combined.json", issues, (entry) => {
      const rank = num(entry.rank);
      const providerId = str(entry.providerId);
      const model = str(entry.model);
      const why = str(entry.why);
      const tier = num(entry.tier);
      if (!rank || !providerId || !model || !why || !tier) return undefined;
      if (![1, 2, 3, 4].includes(tier)) return undefined;
      return { rank, providerId, model, why, tier: tier as CombinedEntry["tier"] };
    }),
    redundancy: readBoard<RedundancyEntry>(dir, "redundancy.json", issues, (entry) => {
      const family = str(entry.family);
      const keep = str(entry.keep);
      const fallback = str(entry.fallback);
      if (!family || !keep || !fallback) return undefined;
      return {
        family,
        keep,
        fallback,
        alsoOn: toArray(entry.alsoOn)
          .map((name) => str(name) ?? "")
          .filter(Boolean),
      };
    }),
    dropList: readBoard<{ provider: string; reason: string }>(
      dir,
      "drop-list.json",
      issues,
      (entry) => {
        const provider = str(entry.provider);
        const reason = str(entry.reason);
        return provider && reason ? { provider, reason } : undefined;
      },
    ),
    bottomLine,
    disclaimer,
    sources,
  };
}

/**
 * Read one board, dropping individual entries that do not parse.
 *
 * Dropping rather than failing the file is deliberate: a board with one bad row
 * still answers the question it was written to answer, and the issue names the
 * file so the row can be found.
 */
function readBoard<T>(
  dir: string,
  name: string,
  issues: CmsIssue[],
  map: (entry: Record<string, unknown>) => T | undefined,
): T[] {
  // Boards are optional: a checkout that only maintains a combined board is
  // legitimate, so a missing file is an empty board, not a problem to report.
  const file = join(dir, name);
  if (!existsSync(file)) return [];

  const raw = readJson(file, `rankings/${name}`, issues);
  if (!Array.isArray(raw)) {
    if (raw !== undefined) issues.push({ file: `rankings/${name}`, message: "expected an array" });
    return [];
  }

  const out: T[] = [];
  raw.forEach((entry, index) => {
    if (!isRecord(entry)) return;
    const mapped = map(entry);
    if (mapped === undefined) {
      issues.push({
        file: `rankings/${name}`,
        message: `entry ${index} is incomplete and was skipped`,
      });
      return;
    }
    out.push(mapped);
  });
  return out;
}

/* -------------------------------------------------------------------------- *\
 * Primitives
\* -------------------------------------------------------------------------- */

function listFiles(dir: string, suffix: string): string[] {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith(suffix) && !name.startsWith("."))
      .sort();
  } catch {
    return [];
  }
}

function readJson(file: string, label: string, issues: CmsIssue[]): unknown {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    issues.push({ file: label, message: (error as Error).message });
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    issues.push({ file: label, message: `invalid JSON — ${(error as Error).message}` });
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Split a Markdown file into frontmatter and body.
 *
 * A deliberately tiny YAML subset — `key: value` lines, optionally quoted. The
 * content repository's frontmatter carries three scalars, and a real YAML parser
 * would be more dependency than the format is worth. Anything richer belongs in
 * the body, where Markdown already handles it.
 */
export function parseFrontMatter(text: string): {
  attributes: Record<string, string>;
  body: string;
} {
  const normalised = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!normalised.startsWith("---\n")) return { attributes: {}, body: normalised.trim() };

  const end = normalised.indexOf("\n---", 3);
  if (end === -1) return { attributes: {}, body: normalised.trim() };

  const attributes: Record<string, string> = {};
  for (const line of normalised.slice(4, end).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf(":");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    attributes[key] = value;
  }

  return {
    attributes,
    body: normalised
      .slice(end + 4)
      .replace(/^\n+/, "")
      .trimEnd(),
  };
}
