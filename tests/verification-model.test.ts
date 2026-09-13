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

/** A fetch stub that answers the models list and records every chat body. */
function stubFetch(liveModels: string[], chatBodies: unknown[]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/models")) {
      return new Response(JSON.stringify({ data: liveModels.map((id) => ({ id })) }), {
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
