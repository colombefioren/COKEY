import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CmsStore,
  curateProvider,
  loadCmsSnapshot,
  parseFrontMatter,
  rankingsView,
  resolveCmsDirectory,
  snapshotSignature,
  undocumentedProviders,
} from "../src/core/cms/index.js";
import { providerDossier } from "../src/catalog/dossiers.js";
import { SKILL_RANKING } from "../src/catalog/rankings.js";

/**
 * The content repository is user-editable and may be mid-checkout, so the
 * property under test throughout this file is tolerance: a broken file costs
 * exactly that file, and every failure says which one it was.
 */

const dirs: string[] = [];

function tempContent(): string {
  const dir = mkdtempSync(join(tmpdir(), "cokey-cms-"));
  dirs.push(dir);
  mkdirSync(join(dir, "providers"), { recursive: true });
  mkdirSync(join(dir, "terms"), { recursive: true });
  mkdirSync(join(dir, "rankings"), { recursive: true });
  return dir;
}

function write(dir: string, relative: string, contents: string): void {
  writeFileSync(join(dir, relative), contents);
}

function provider(id: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id,
    displayName: `${id} API`,
    operator: `${id} Ltd`,
    origin: "France",
    kind: "aggregator",
    summary: "A free pool with a published daily allowance.",
    verdict: "usable",
    verdictReason: "Worth a key if the allowance holds up.",
    reviewedAt: "2026-09-01",
    baseUrl: `https://api.${id}.test/v1`,
    apiStyle: "openai",
    authScheme: "bearer",
    signupUrl: `https://${id}.test/keys`,
    freeTier: { advertised: true, summary: "1M tokens/day", quotaSource: "provider" },
    credentialFields: ["secret"],
    models: [{ id: "model-a", context: "128K", bestFor: "Code", latencySeconds: 0.4 }],
    ...extra,
  });
}

/** A complete ranking set, since `meta.json` is what makes the boards usable. */
function writeRankings(dir: string): void {
  write(
    dir,
    "rankings/meta.json",
    JSON.stringify({
      tiers: [{ name: "S", label: "Purpose-built", blurb: "Start here." }],
      sources: [{ label: "Operator limits page", url: "https://example.test/limits" }],
      disclaimer: "Benchmarks move; your own key is the only score that counts.",
      bottomLine: "Two providers cover daily volume.",
    }),
  );
  write(
    dir,
    "rankings/skill.json",
    JSON.stringify([
      {
        model: "curated-coder",
        providerId: "alpha",
        tierName: "S",
        sweScore: 61.5,
        reason: "Fine-tuned for code.",
      },
    ]),
  );
  write(
    dir,
    "rankings/rate-limits.json",
    JSON.stringify([
      {
        providerId: "alpha",
        provider: "Alpha",
        tier: 1,
        quota: "10,000 requests/day",
        provenance: "operator",
        reliability: "solid",
      },
    ]),
  );
  write(
    dir,
    "rankings/combined.json",
    JSON.stringify([
      { rank: 1, providerId: "alpha", model: "curated-coder", why: "Volume and skill.", tier: 1 },
    ]),
  );
  write(
    dir,
    "rankings/redundancy.json",
    JSON.stringify([
      { family: "curated-coder", alsoOn: ["beta"], keep: "alpha", fallback: "beta" },
    ]),
  );
  write(
    dir,
    "rankings/drop-list.json",
    JSON.stringify([{ provider: "gamma", reason: "Five requests a day." }]),
  );
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("resolveCmsDirectory", () => {
  it("honours COKEY_CMS_DIR above everything else", () => {
    const configured = tempContent();
    expect(resolveCmsDirectory({ COKEY_CMS_DIR: configured }, "/nowhere")).toBe(configured);
  });

  it("falls back to a content checkout beside the project", () => {
    const cwd = mkdtempSync(join(tmpdir(), "cokey-cwd-"));
    dirs.push(cwd);
    const content = join(cwd, "cms", "content");
    mkdirSync(content, { recursive: true });
    expect(resolveCmsDirectory({}, cwd)).toBe(content);
  });

  it("returns the first candidate when nothing exists, so the failure names a path", () => {
    expect(resolveCmsDirectory({}, "/nowhere-at-all")).toBe("/nowhere-at-all/cms/content");
  });
});

describe("loadCmsSnapshot", () => {
  it("reports a missing directory as one issue rather than throwing", () => {
    const snapshot = loadCmsSnapshot("/definitely/not/here");
    expect(snapshot.providers.size).toBe(0);
    expect(snapshot.issues).toHaveLength(1);
    expect(snapshot.issues[0]!.message).toContain("not found");
  });

  it("reads providers, terms and rankings", () => {
    const dir = tempContent();
    write(dir, "providers/alpha.json", provider("alpha"));
    write(dir, "providers/beta.json", provider("beta", { verdict: "limited" }));
    write(
      dir,
      "terms/second.md",
      "---\ntitle: Second\norder: 2\nupdatedAt: 2026-09-10\n---\n\nBody two.\n",
    );
    write(
      dir,
      "terms/first.md",
      "---\ntitle: First\norder: 1\nupdatedAt: 2026-09-01\n---\n\nBody one.\n",
    );
    writeRankings(dir);

    const snapshot = loadCmsSnapshot(dir);

    expect(snapshot.issues).toEqual([]);
    expect([...snapshot.providers.keys()].sort()).toEqual(["alpha", "beta"]);
    // Terms come back in reading order, not directory order.
    expect(snapshot.terms.map((section) => section.title)).toEqual(["First", "Second"]);
    expect(snapshot.rankings?.combined).toHaveLength(1);
    expect(snapshot.rankings?.sources).toHaveLength(1);
  });

  it("keeps every other provider when one file is not valid JSON", () => {
    const dir = tempContent();
    write(dir, "providers/alpha.json", provider("alpha"));
    write(dir, "providers/broken.json", "{ this is not json");
    write(dir, "providers/gamma.json", provider("gamma"));

    const snapshot = loadCmsSnapshot(dir);

    expect([...snapshot.providers.keys()].sort()).toEqual(["alpha", "gamma"]);
    expect(snapshot.issues).toHaveLength(1);
    expect(snapshot.issues[0]!.file).toBe("providers/broken.json");
    expect(snapshot.issues[0]!.message).toContain("invalid JSON");
  });

  it("names a provider whose id disagrees with its file name", () => {
    const dir = tempContent();
    write(dir, "providers/alpha.json", provider("not-alpha"));

    const snapshot = loadCmsSnapshot(dir);

    expect(snapshot.issues[0]!.message).toContain('declares id "not-alpha"');
    // The file name still wins, because the file name is what a reader opens.
    expect(snapshot.providers.has("alpha")).toBe(true);
  });

  it("ignores an unknown verdict rather than trusting it", () => {
    const dir = tempContent();
    write(dir, "providers/alpha.json", provider("alpha", { verdict: "amazing" }));

    const snapshot = loadCmsSnapshot(dir);

    expect(snapshot.providers.get("alpha")!.verdict).toBeUndefined();
    expect(snapshot.issues.some((issue) => issue.message.includes("unknown verdict"))).toBe(true);
  });

  it("skips a model entry with no id", () => {
    const dir = tempContent();
    write(
      dir,
      "providers/alpha.json",
      provider("alpha", { models: [{ context: "128K" }, { id: "model-b" }] }),
    );

    const snapshot = loadCmsSnapshot(dir);

    expect(snapshot.providers.get("alpha")!.models.map((model) => model.id)).toEqual(["model-b"]);
    expect(snapshot.issues[0]!.message).toContain("no id");
  });

  it("rejects two terms sections claiming the same position", () => {
    const dir = tempContent();
    write(dir, "terms/a.md", "---\ntitle: A\norder: 1\nupdatedAt: 2026-09-01\n---\n\nA body.\n");
    write(dir, "terms/b.md", "---\ntitle: B\norder: 1\nupdatedAt: 2026-09-01\n---\n\nB body.\n");

    const snapshot = loadCmsSnapshot(dir);

    expect(snapshot.terms).toHaveLength(1);
    expect(snapshot.issues[0]!.message).toContain("order 1 is already used");
  });

  it("drops the boards entirely when meta.json is missing", () => {
    const dir = tempContent();
    write(dir, "rankings/skill.json", JSON.stringify([{ model: "x", tierName: "S", reason: "y" }]));

    const snapshot = loadCmsSnapshot(dir);

    // Without sources and a disclaimer a ranking is an assertion, not a finding.
    expect(snapshot.rankings).toBeUndefined();
    expect(snapshot.issues.some((issue) => issue.file === "rankings/meta.json")).toBe(true);
  });

  it("treats an empty rankings directory as an empty checkout, not a mistake", () => {
    const dir = tempContent();
    expect(loadCmsSnapshot(dir).issues).toEqual([]);
  });

  it("drops only the incomplete rows of a board", () => {
    const dir = tempContent();
    writeRankings(dir);
    write(
      dir,
      "rankings/combined.json",
      JSON.stringify([
        { rank: 1, providerId: "alpha", model: "a", why: "ok", tier: 1 },
        { rank: 2, providerId: "beta" },
      ]),
    );

    const snapshot = loadCmsSnapshot(dir);

    expect(snapshot.rankings!.combined).toHaveLength(1);
    expect(snapshot.issues.some((issue) => issue.message.includes("incomplete"))).toBe(true);
  });
});

describe("parseFrontMatter", () => {
  it("splits attributes from the body", () => {
    const parsed = parseFrontMatter("---\ntitle: Hello\norder: 3\n---\n\nBody line.\n");
    expect(parsed.attributes.title).toBe("Hello");
    expect(parsed.body).toBe("Body line.");
  });

  it("strips a matching pair of quotes so a value may start with a digit", () => {
    expect(parseFrontMatter('---\ntitle: "404 page"\n---\n\nx\n').attributes.title).toBe(
      "404 page",
    );
  });

  it("treats a file with no frontmatter as body-only", () => {
    const parsed = parseFrontMatter("Just prose.");
    expect(parsed.attributes).toEqual({});
    expect(parsed.body).toBe("Just prose.");
  });

  it("survives an unterminated header without swallowing the file", () => {
    const parsed = parseFrontMatter("---\ntitle: Oops\n\nbody");
    expect(parsed.attributes).toEqual({});
    expect(parsed.body).toContain("body");
  });
});

describe("CmsStore", () => {
  it("reports a change only when something visible changed", () => {
    const dir = tempContent();
    write(dir, "providers/alpha.json", provider("alpha"));
    const store = new CmsStore({ directory: dir });
    try {
      // A re-read that produces the same snapshot must stay quiet: editors write
      // files on save even when nothing moved.
      expect(store.reload()).toBe(false);

      write(dir, "providers/beta.json", provider("beta"));
      expect(store.reload()).toBe(true);
      expect(store.current.providers.size).toBe(2);
    } finally {
      store.close();
    }
  });

  it("notifies subscribers with the new snapshot", () => {
    const dir = tempContent();
    const seen: number[] = [];
    const store = new CmsStore({
      directory: dir,
      onChange: (snapshot) => seen.push(snapshot.providers.size),
    });
    try {
      write(dir, "providers/alpha.json", provider("alpha"));
      store.reload();
      expect(seen).toEqual([1]);
    } finally {
      store.close();
    }
  });

  it("stops notifying after close", () => {
    const dir = tempContent();
    let calls = 0;
    const store = new CmsStore({ directory: dir, onChange: () => (calls += 1) });
    store.close();
    write(dir, "providers/alpha.json", provider("alpha"));
    store.reload();
    expect(calls).toBe(0);
  });

  it("summarises itself for the status endpoint", () => {
    const dir = tempContent();
    write(dir, "providers/alpha.json", provider("alpha"));
    writeRankings(dir);
    const store = new CmsStore({ directory: dir });
    try {
      const status = store.status();
      expect(status.available).toBe(true);
      expect(status.directory).toBe(dir);
      expect(status.counts.providers).toBe(1);
      expect(status.counts.models).toBe(1);
      expect(status.counts.ranked).toBe(1);
      expect(status.issues).toEqual([]);
    } finally {
      store.close();
    }
  });

  it("reports an empty directory as unavailable but still readable", () => {
    const store = new CmsStore({ directory: tempContent() });
    try {
      expect(store.status().available).toBe(false);
      expect(store.status().issues).toEqual([]);
    } finally {
      store.close();
    }
  });
});

describe("snapshotSignature", () => {
  it("ignores loadedAt, which changes on every read", () => {
    const dir = tempContent();
    write(dir, "providers/alpha.json", provider("alpha"));
    const first = loadCmsSnapshot(dir);
    const second = loadCmsSnapshot(dir);
    // The reader's own clock is not content, so a re-read of an unchanged
    // directory must produce the same fingerprint even though loadedAt moved.
    expect(snapshotSignature({ ...second, loadedAt: second.loadedAt + 5_000 })).toBe(
      snapshotSignature(first),
    );
  });

  it("changes when a review date or model list changes", () => {
    const dir = tempContent();
    write(dir, "providers/alpha.json", provider("alpha"));
    const before = snapshotSignature(loadCmsSnapshot(dir));

    write(dir, "providers/alpha.json", provider("alpha", { reviewedAt: "2026-09-12" }));
    expect(snapshotSignature(loadCmsSnapshot(dir))).not.toBe(before);
  });

  it("changes when a verdict is flipped, which no count would reveal", () => {
    const dir = tempContent();
    write(dir, "providers/alpha.json", provider("alpha", { verdict: "usable" }));
    const before = snapshotSignature(loadCmsSnapshot(dir));

    // Same file, same models, same review date: only the opinion moved.
    write(dir, "providers/alpha.json", provider("alpha", { verdict: "limited" }));
    expect(snapshotSignature(loadCmsSnapshot(dir))).not.toBe(before);
  });
});

describe("curateProvider", () => {
  it("falls back to the compiled catalog when no content is loaded", () => {
    const dossier = curateProvider("groq");
    expect(dossier.source).toBe("compiled");
    expect(dossier).toEqual({ ...providerDossier("groq"), source: "compiled" });
  });

  it("lets the content repository override the compiled dossier", () => {
    const dir = tempContent();
    write(
      dir,
      "providers/groq.json",
      provider("groq", {
        operator: "Groq, Inc.",
        verdict: "limited",
        verdictReason: "The free tier shrank in the last revision.",
        notes: "Verify the daily cap on your own dashboard.",
      }),
    );

    const dossier = curateProvider("groq", loadCmsSnapshot(dir));

    expect(dossier.source).toBe("cms");
    expect(dossier.verdict).toBe("limited");
    expect(dossier.notes).toContain("Verify the daily cap");
    expect(dossier.reviewedAt).toBe("2026-09-01");
    // The model list survives so the detail window can show context and latency.
    expect(dossier.models?.map((model) => model.id)).toEqual(["model-a"]);
  });

  it("fills the gaps in a half-finished dossier from the compiled catalog", () => {
    const dir = tempContent();
    write(dir, "providers/groq.json", JSON.stringify({ id: "groq", verdict: "recommended" }));

    const dossier = curateProvider("groq", loadCmsSnapshot(dir));

    // A dossier that only states a verdict still gets its operator and summary.
    expect(dossier.operator).toBe(providerDossier("groq").operator);
    expect(dossier.summary).toBe(providerDossier("groq").summary);
    expect(dossier.verdict).toBe("recommended");
  });

  it("gives a provider nobody documented the neutral verdict", () => {
    const dossier = curateProvider("some-unknown-provider");
    expect(dossier.verdict).toBe("limited");
    expect(dossier.operator).toBe("Not publicly disclosed");
  });
});

describe("rankingsView", () => {
  it("serves the compiled boards when no content is loaded", () => {
    const view = rankingsView();
    expect(view.source).toBe("compiled");
    expect(view.skill).toBe(SKILL_RANKING);
    expect(view.counts.combined).toBeGreaterThan(0);
  });

  it("prefers the curated boards and records what they contain", () => {
    const dir = tempContent();
    writeRankings(dir);
    const view = rankingsView(loadCmsSnapshot(dir));

    expect(view.source).toBe("cms");
    expect(view.skill.map((entry) => entry.model)).toEqual(["curated-coder"]);
    expect(view.counts).toEqual({ skill: 1, rateLimit: 1, combined: 1 });
    // Newest review across the dossiers, so the UI can say how current it is.
    expect(view.reviewedAt).toBeUndefined();
  });
});

describe("undocumentedProviders", () => {
  it("names providers the content documents that this build cannot serve", () => {
    const dir = tempContent();
    write(dir, "providers/alpha.json", provider("alpha"));
    write(dir, "providers/groq.json", provider("groq", { operator: "Groq, Inc." }));

    expect(undocumentedProviders(loadCmsSnapshot(dir))).toEqual(["alpha"]);
  });

  it("returns nothing without a snapshot", () => {
    expect(undocumentedProviders()).toEqual([]);
  });
});
