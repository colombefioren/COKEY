import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addCredential, createHarness, StubAdapter, type Harness } from "./helpers/harness.js";

const REQUEST = { model: "best", messages: [{ role: "user", content: "hello" }] };
const BASE = "https://stub.test/v1";

let h: Harness;

beforeEach(() => {
  h = createHarness();
});

afterEach(() => {
  h.cleanup();
});

describe("router fallback order", () => {
  it("rotates every credential of an entry before touching the next entry", async () => {
    // Test A: Groq Key1 → 429, Key2 → 429, Key3 → 200.
    // Expected order is Key1, Key2, Key3 — never Key1, Model2.
    const key1 = addCredential(h, "groq", "key-1");
    const key2 = addCredential(h, "groq", "key-2");
    const key3 = addCredential(h, "groq", "key-3");

    const adapter = new StubAdapter((credential) =>
      credential.id === key3.id
        ? { status: 200 }
        : { status: 429, body: { error: { message: "rate limit exceeded" } } },
    );
    h.registry.register("groq", adapter);

    const chain = h.chains.createChain({ alias: "best" });
    h.chains.addEntry({
      chainId: chain.id,
      providerId: "groq",
      model: "qwen/qwen3.8-27b",
      baseUrl: BASE,
      credentialIds: [key1.id, key2.id, key3.id],
    });

    const result = await h.router.route("best", REQUEST);

    expect(adapter.calls.map((call) => call.description)).toEqual(["key-1", "key-2", "key-3"]);
    expect(result.credentialDescription).toBe("key-3");
    expect(result.fallback).toBe(true);
    expect(result.fallbackReason).toBe("rate_limit");
  });

  it("falls back across entries only once the first entry is exhausted", async () => {
    // Test B: E1K1 → 401, E1K2 → 429, E1K3 → 429, E2K1 → 200.
    const e1k1 = addCredential(h, "groq", "e1-key-1");
    const e1k2 = addCredential(h, "groq", "e1-key-2");
    const e1k3 = addCredential(h, "groq", "e1-key-3");
    const e2k1 = addCredential(h, "openrouter", "e2-key-1");

    const groq = new StubAdapter((credential) =>
      credential.id === e1k1.id
        ? { status: 401, body: { error: { message: "invalid api key" } } }
        : { status: 429, body: { error: { message: "rate limit exceeded" } } },
    );
    const openrouter = new StubAdapter(() => ({ status: 200 }));

    h.registry.register("groq", groq);
    h.registry.register("openrouter", openrouter);

    const chain = h.chains.createChain({ alias: "best" });
    h.chains.addEntry({
      chainId: chain.id,
      providerId: "groq",
      model: "qwen/qwen3.8-27b",
      baseUrl: BASE,
      credentialIds: [e1k1.id, e1k2.id, e1k3.id],
    });
    h.chains.addEntry({
      chainId: chain.id,
      providerId: "openrouter",
      model: "deepseek/deepseek-v4-flash:free",
      baseUrl: BASE,
      credentialIds: [e2k1.id],
    });

    const result = await h.router.route("best", REQUEST);

    expect(groq.calls.map((call) => call.description)).toEqual([
      "e1-key-1",
      "e1-key-2",
      "e1-key-3",
    ]);
    expect(openrouter.calls.map((call) => call.description)).toEqual(["e2-key-1"]);
    expect(result.providerId).toBe("openrouter");
    expect(result.fallback).toBe(true);
  });

  it("skips to the next entry on context_too_large instead of halting", async () => {
    // Test C: a context-too-large 400 on entry 1 must skip to entry 2.
    const key1 = addCredential(h, "groq", "key-1");
    const e2key = addCredential(h, "openrouter", "e2-key-1");

    const groq = new StubAdapter(() => ({
      status: 400,
      body: { error: { message: "This model's maximum context length is 131072 tokens" } },
    }));
    const openrouter = new StubAdapter(() => ({ status: 200 }));
    h.registry.register("groq", groq);
    h.registry.register("openrouter", openrouter);

    const chain = h.chains.createChain({ alias: "best" });
    h.chains.addEntry({
      chainId: chain.id,
      providerId: "groq",
      model: "qwen/qwen3.8-27b",
      baseUrl: BASE,
      credentialIds: [key1.id],
    });
    h.chains.addEntry({
      chainId: chain.id,
      providerId: "openrouter",
      model: "deepseek/deepseek-v4-flash:free",
      baseUrl: BASE,
      credentialIds: [e2key.id],
    });

    const result = await h.router.route("best", REQUEST);

    expect(groq.calls).toHaveLength(1);
    expect(openrouter.calls).toHaveLength(1);
    expect(result.providerId).toBe("openrouter");
    expect(result.fallback).toBe(true);
    expect(result.fallbackReason).toBe("context_too_large");
  });

  it("follows the user's order after a reorder", async () => {
    // Test D: reordering an entry above another changes the first model tried.
    const key = addCredential(h, "groq", "shared-key");
    const adapter = new StubAdapter((_credential, model) =>
      model === "model-one"
        ? { status: 500, body: { error: { message: "upstream exploded" } } }
        : { status: 200 },
    );
    h.registry.register("groq", adapter);

    const chain = h.chains.createChain({ alias: "best" });
    const first = h.chains.addEntry({
      chainId: chain.id,
      providerId: "groq",
      model: "model-one",
      baseUrl: BASE,
      credentialIds: [key.id],
    });
    const second = h.chains.addEntry({
      chainId: chain.id,
      providerId: "groq",
      model: "model-two",
      baseUrl: BASE,
      credentialIds: [key.id],
    });

    h.chains.reorder(chain.id, [second.id, first.id]);

    const result = await h.router.route("best", REQUEST);
    expect(adapter.calls[0]?.model).toBe("model-two");
    expect(result.entryModel).toBe("model-two");
  });

  it("skips credentials that are still cooling down on the next request", async () => {
    const key1 = addCredential(h, "groq", "key-1");
    const key2 = addCredential(h, "groq", "key-2");

    const adapter = new StubAdapter((credential) =>
      credential.id === key1.id
        ? { status: 429, body: { error: { message: "rate limit exceeded" } } }
        : { status: 200 },
    );
    h.registry.register("groq", adapter);

    const chain = h.chains.createChain({ alias: "best" });
    h.chains.addEntry({
      chainId: chain.id,
      providerId: "groq",
      model: "qwen/qwen3.8-27b",
      baseUrl: BASE,
      credentialIds: [key1.id, key2.id],
    });

    await h.router.route("best", REQUEST);
    adapter.calls.length = 0;
    await h.router.route("best", REQUEST);

    // key-1 is cooling down, so the second request must start at key-2.
    expect(adapter.calls.map((call) => call.description)).toEqual(["key-2"]);
    expect(h.credentials.get(key1.id)?.status).toBe("cooldown");
  });
});

describe("live routing feedback", () => {
  it("narrates each key change and leaves a success snapshot", async () => {
    const key1 = addCredential(h, "groq", "key-1");
    const key2 = addCredential(h, "groq", "key-2", { proxyUrl: "socks5://user:pass@127.0.0.1:1080" });

    const adapter = new StubAdapter((credential) =>
      credential.id === key2.id
        ? { status: 200 }
        : { status: 429, body: { error: { message: "rate limit exceeded" } } },
    );
    h.registry.register("groq", adapter);

    const chain = h.chains.createChain({ alias: "best" });
    h.chains.addEntry({
      chainId: chain.id,
      providerId: "groq",
      model: "qwen/qwen3.8-27b",
      baseUrl: BASE,
      credentialIds: [key1.id, key2.id],
    });

    await h.router.route("best", REQUEST);

    const switches = h.events.recent().filter((event) => event.type === "route.switch");
    expect(switches).toHaveLength(1);
    expect(switches[0]?.previous?.credentialDescription).toBe("key-1");
    expect(switches[0]?.credentialDescription).toBe("key-2");
    expect(switches[0]?.message).toContain("key-2");

    const route = h.events.routeSnapshot();
    expect(route.active).toBe(false);
    expect(route.lastOutcome).toBe("success");
    expect(route.credentialDescription).toBe("key-2");
    expect(route.fallback).toBe(true);
  });

  it("records observed requests per credential", async () => {
    const key1 = addCredential(h, "groq", "key-1");
    const key2 = addCredential(h, "groq", "key-2");

    const adapter = new StubAdapter((credential) =>
      credential.id === key1.id
        ? { status: 429, body: { error: { message: "rate limit exceeded" } } }
        : { status: 200 },
    );
    h.registry.register("groq", adapter);

    const chain = h.chains.createChain({ alias: "best" });
    h.chains.addEntry({
      chainId: chain.id,
      providerId: "groq",
      model: "qwen/qwen3.8-27b",
      baseUrl: BASE,
      credentialIds: [key1.id, key2.id],
    });

    await h.router.route("best", REQUEST);

    expect(h.rates.snapshot(key1.id).requestsPerMinute).toBe(1);
    expect(h.rates.snapshot(key2.id).requestsPerMinute).toBe(1);
    expect(h.rates.snapshot(key1.id).recentlyRateLimited).toBe(true);
    expect(h.rates.snapshot(key2.id).recentlyRateLimited).toBe(false);
  });
});
