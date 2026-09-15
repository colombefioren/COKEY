import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleAdapter } from "../src/core/providers/openai-compatible.js";
import type { ProviderCatalogEntry } from "../src/catalog/types.js";
import type { Credential } from "../src/core/types.js";
import { emptyUsage } from "../src/core/types.js";

function catalog(knownModels: string[]): ProviderCatalogEntry {
  return {
    id: "xkiro",
    displayName: "xKiro AI",
    baseUrl: "https://api.xkiro.test/v1",
    apiStyle: "openai",
    authScheme: "bearer",
    signupUrl: "https://xkiro.test",
    freeTier: { advertised: true, summary: "free", quotaSource: "unknown" },
    knownModels,
    credentialFields: ["secret"],
    verification: { method: "models" },
  };
}

function credential(): Credential {
  return {
    id: "cred-1",
    providerId: "xkiro",
    secret: "sk-test",
    description: "test key",
    status: "unverified",
    consecutiveFailures: 0,
    usage: emptyUsage(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function stubFetch(liveModels: string[], chatBodies: unknown[]) {
  return stubFetchWithEntries(
    liveModels.map((id) => ({ id })),
    chatBodies,
  );
}

function stubFetchWithEntries(liveModels: Array<Record<string, unknown>>, chatBodies: unknown[]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/models")) {
      return new Response(JSON.stringify({ data: liveModels }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/chat/completions")) {
      chatBodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`Unexpected URL in test: ${url}`);
  });
}

describe("OpenAICompatibleAdapter verification model selection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("skips a curated model the provider no longer serves and verifies with one that is still live", async () => {
    const chatBodies: unknown[] = [];
    vi.stubGlobal("fetch", stubFetch(["live-model"], chatBodies));

    const adapter = new OpenAICompatibleAdapter(catalog(["stale-model", "live-model"]));
    const result = await adapter.validateCredential(credential());

    expect(result.ok).toBe(true);
    expect(chatBodies).toHaveLength(1);
    expect((chatBodies[0] as { model: string }).model).toBe("live-model");
  });

  it("falls back to whatever the provider does list when no curated model survived", async () => {
    const chatBodies: unknown[] = [];
    vi.stubGlobal("fetch", stubFetch(["brand-new-model"], chatBodies));

    const adapter = new OpenAICompatibleAdapter(catalog(["stale-model", "also-stale"]));
    await adapter.validateCredential(credential());

    expect((chatBodies[0] as { model: string }).model).toBe("brand-new-model");
  });

  it("prefers a curated :free model over one that merely still appears in the listing", async () => {
    const chatBodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      stubFetch(["mistralai/codestral-2508", "qwen/qwen3.6-27b:free"], chatBodies),
    );

    const adapter = new OpenAICompatibleAdapter(
      catalog(["mistralai/codestral-2508", "qwen/qwen3.6-27b:free"]),
    );
    await adapter.validateCredential(credential());

    expect((chatBodies[0] as { model: string }).model).toBe("qwen/qwen3.6-27b:free");
  });

  it("prefers a :free model from the live listing when no curated model survived", async () => {
    const chatBodies: unknown[] = [];
    vi.stubGlobal("fetch", stubFetch(["brand-new-paid-model", "brand-new-model:free"], chatBodies));

    const adapter = new OpenAICompatibleAdapter(catalog(["stale-model"]));
    await adapter.validateCredential(credential());

    expect((chatBodies[0] as { model: string }).model).toBe("brand-new-model:free");
  });

  it("skips a curated model the listing marks paid, even though it is still served", async () => {
    const chatBodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      stubFetchWithEntries(
        [
          { id: "mistralai/codestral-2508", access_tier: "premium" },
          { id: "some/new-free-model", access_tier: "free" },
        ],
        chatBodies,
      ),
    );

    const adapter = new OpenAICompatibleAdapter(catalog(["mistralai/codestral-2508"]));
    const result = await adapter.validateCredential(credential());

    expect(result.ok).toBe(true);
    expect((chatBodies[0] as { model: string }).model).toBe("some/new-free-model");
  });

  it("falls back to the curated guess when the listing itself fails", async () => {
    const chatBodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/models")) return new Response("boom", { status: 500 });
        chatBodies.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    const adapter = new OpenAICompatibleAdapter(catalog(["stale-model"]));
    await adapter.validateCredential(credential());

    expect((chatBodies[0] as { model: string }).model).toBe("stale-model");
  });
});
