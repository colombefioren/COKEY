import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { Cokey } from "../src/core/cokey.js";
import { DEFAULT_ADMIN_PASSWORD } from "../src/core/settings.js";
import { createServer } from "../src/server/server.js";

/**
 * The content API, exercised through the real server.
 *
 * The loader's tolerance is unit-tested separately; what matters here is the
 * wiring a user actually hits: that the content endpoints exist, that they are
 * behind authentication like every other management route, and that editing a
 * file on disk is reflected the next time the dashboard asks.
 */

interface Harness {
  app: FastifyInstance;
  cokey: Cokey;
  contentDir: string;
  cookie: string;
  cleanup: () => void;
}

const cleanups: Array<() => void> = [];

function providerFile(id: string, extra: Record<string, unknown> = {}): string {
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
    models: [{ id: "model-a", context: "128K", bestFor: "Code" }],
    ...extra,
  });
}

async function harness(): Promise<Harness> {
  const dir = mkdtempSync(join(tmpdir(), "cokey-content-"));
  const contentDir = join(dir, "content");
  mkdirSync(join(contentDir, "providers"), { recursive: true });
  mkdirSync(join(contentDir, "terms"), { recursive: true });
  mkdirSync(join(contentDir, "rankings"), { recursive: true });

  writeFileSync(join(contentDir, "providers", "groq.json"), providerFile("groq"));
  writeFileSync(
    join(contentDir, "terms", "what-this-is.md"),
    "---\ntitle: What COKEY is\norder: 1\nupdatedAt: 2026-09-13\n---\n\nA local gateway.\n",
  );
  writeFileSync(
    join(contentDir, "rankings", "meta.json"),
    JSON.stringify({
      tiers: [{ name: "S", label: "Purpose-built", blurb: "Start here." }],
      sources: [{ label: "Operator page", url: "https://example.test/limits" }],
      disclaimer: "Benchmarks move; your own key is the only score that counts.",
      bottomLine: "Two providers cover daily volume.",
    }),
  );
  writeFileSync(
    join(contentDir, "rankings", "combined.json"),
    JSON.stringify([{ rank: 1, providerId: "groq", model: "model-a", why: "Volume.", tier: 1 }]),
  );

  const cokey = new Cokey({
    dataDir: join(dir, "data"),
    silent: true,
    env: { COKEY_CMS_DIR: contentDir },
  });
  const app = await createServer(cokey, { serveUi: false });

  const login = await app.inject({
    method: "POST",
    url: "/api/session",
    payload: { password: DEFAULT_ADMIN_PASSWORD },
  });
  const cookie = String(login.headers["set-cookie"] ?? "").split(";")[0] ?? "";

  const cleanup = (): void => {
    cokey.stop();
    rmSync(dir, { recursive: true, force: true });
  };
  cleanups.push(cleanup);

  return { app, cokey, contentDir, cookie, cleanup };
}

afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

describe("content API", () => {
  it("requires authentication like every other management route", async () => {
    const { app } = await harness();
    const response = await app.inject({ method: "GET", url: "/api/content/status" });
    expect(response.statusCode).toBe(401);
  });

  it("reports where the content came from and what it contains", async () => {
    const { app, contentDir, cookie } = await harness();
    const response = await app.inject({
      method: "GET",
      url: "/api/content/status",
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.available).toBe(true);
    expect(body.directory).toBe(contentDir);
    expect(body.counts.providers).toBe(1);
    expect(body.counts.terms).toBe(1);
    expect(body.issues).toEqual([]);
  });

  it("serves the terms document in reading order", async () => {
    const { app, cookie } = await harness();
    const body = (
      await app.inject({ method: "GET", url: "/api/content/terms", headers: { cookie } })
    ).json();

    expect(body.sections).toHaveLength(1);
    expect(body.sections[0]).toMatchObject({ slug: "what-this-is", order: 1 });
    expect(body.updatedAt).toBe("2026-09-13");
  });

  it("curates a provider with the repository's dossier and marks its source", async () => {
    const { app, cookie } = await harness();
    const body = (
      await app.inject({
        method: "GET",
        url: "/api/content/providers/groq",
        headers: { cookie },
      })
    ).json();

    expect(body.known).toBe(true);
    expect(body.dossier.source).toBe("cms");
    expect(body.dossier.reviewedAt).toBe("2026-09-01");
    expect(body.dossier.models.map((model: { id: string }) => model.id)).toEqual(["model-a"]);
  });

  it("falls back to the compiled dossier for a provider the content does not cover", async () => {
    const { app, cookie } = await harness();
    const body = (
      await app.inject({
        method: "GET",
        url: "/api/content/providers/cloudflare",
        headers: { cookie },
      })
    ).json();

    expect(body.dossier.source).toBe("compiled");
    expect(body.dossier.operator).toBe("Cloudflare, Inc.");
  });

  it("serves the curated ranking boards", async () => {
    const { app, cookie } = await harness();
    const body = (
      await app.inject({ method: "GET", url: "/api/catalog/rankings", headers: { cookie } })
    ).json();

    expect(body.source).toBe("cms");
    expect(body.combined).toHaveLength(1);
  });

  it("picks up an edit made on disk, and says whether it changed anything", async () => {
    const { app, contentDir, cookie } = await harness();

    const unchanged = await app.inject({
      method: "POST",
      url: "/api/content/reload",
      headers: { cookie },
    });
    // Nothing moved, so the button must not claim it reloaded anything.
    expect(unchanged.json().changed).toBe(false);

    writeFileSync(
      join(contentDir, "providers", "groq.json"),
      providerFile("groq", { verdict: "limited" }),
    );

    const changed = await app.inject({
      method: "POST",
      url: "/api/content/reload",
      headers: { cookie },
    });
    const body = changed.json();
    expect(body.changed).toBe(true);

    const dossier = (
      await app.inject({
        method: "GET",
        url: "/api/content/providers/groq",
        headers: { cookie },
      })
    ).json();
    expect(dossier.dossier.verdict).toBe("limited");
  });

  it("keeps serving the catalog when a content file is broken", async () => {
    const { app, contentDir, cookie } = await harness();
    writeFileSync(join(contentDir, "providers", "broken.json"), "{ not json");

    await app.inject({ method: "POST", url: "/api/content/reload", headers: { cookie } });

    const status = (
      await app.inject({ method: "GET", url: "/api/content/status", headers: { cookie } })
    ).json();
    // The provider still serves, and the problem names its file.
    expect(status.counts.providers).toBe(1);
    expect(status.issues[0]).toMatchObject({ file: "providers/broken.json" });

    const providers = (
      await app.inject({ method: "GET", url: "/api/providers", headers: { cookie } })
    ).json();
    expect(providers.data.length).toBeGreaterThan(0);
  });
});
