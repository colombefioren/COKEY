import { afterAll, describe, expect, it } from "vitest";
import { findProvider } from "../src/catalog/providers.js";
import { OpenAICompatibleAdapter } from "../src/core/providers/openai-compatible.js";
import { PROXIFLY_FREE_LIST_URL, parseProxiflyList } from "../src/core/providers/proxifly.js";
import {
  closeProxyDispatchers,
  dispatcherFor,
  parseProxyUrl,
  proxyLabel,
} from "../src/core/providers/proxy.js";
import type { ChainEntry, ChatCompletionRequest, Credential } from "../src/core/types.js";
import { emptyUsage } from "../src/core/types.js";

afterAll(async () => {
  await closeProxyDispatchers();
});

describe("parseProxyUrl", () => {
  it("returns undefined when no proxy is configured", () => {
    expect(parseProxyUrl(undefined)).toBeUndefined();
    expect(parseProxyUrl(null)).toBeUndefined();
    expect(parseProxyUrl("   ")).toBeUndefined();
  });

  it("accepts socks5 with credentials and hides them in the label", () => {
    const parsed = parseProxyUrl("socks5://user:pass@127.0.0.1:1080");
    expect(parsed?.protocol).toBe("socks5");
    expect(parsed?.label).toBe("127.0.0.1:1080");
    expect(parsed?.hasAuth).toBe(true);
  });

  it("treats socks:// and socks5h:// as socks5", () => {
    expect(parseProxyUrl("socks://proxy.test:9050")?.protocol).toBe("socks5");
    expect(parseProxyUrl("socks5h://proxy.test:9050")?.protocol).toBe("socks5");
  });

  it("accepts http and https proxies", () => {
    expect(parseProxyUrl("http://proxy.test:8080")?.protocol).toBe("http");
    expect(parseProxyUrl("https://proxy.test:8443")?.protocol).toBe("http");
  });

  it("rejects unsupported or malformed URLs instead of failing later", () => {
    expect(() => parseProxyUrl("socks4://proxy.test:1080")).toThrow(/Unsupported/);
    expect(() => parseProxyUrl("ftp://proxy.test:21")).toThrow(/Unsupported/);
    expect(() => parseProxyUrl("not a url")).toThrow(/Invalid proxy URL/);
  });

  it("labels without leaking proxy credentials", () => {
    expect(proxyLabel("socks5://alice:hunter2@egress.test:1080")).toBe("egress.test:1080");
    expect(proxyLabel("nonsense")).toBeUndefined();
    expect(proxyLabel(undefined)).toBeUndefined();
  });
});

describe("parseProxiflyList", () => {
  it("parses socks5 lines and deduplicates them", () => {
    const list = parseProxiflyList(
      "socks5://a.test:1080\nsocks5://b.test:1080\n\nsocks5://a.test:1080\n",
    );
    expect(list.urls).toEqual(["socks5://a.test:1080", "socks5://b.test:1080"]);
    expect(list.schemaSummary).toBe("socks5");
  });

  it("skips garbage lines instead of failing the batch", () => {
    const list = parseProxiflyList("socks5://ok.test:1080\nnot a url\nsocks4://old.test:1080\n");
    expect(list.urls).toEqual(["socks5://ok.test:1080"]);
  });

  it("supports crlf line endings", () => {
    const list = parseProxiflyList("socks5://a.test:1080\r\nsocks5://b.test:1080\r\n");
    expect(list.urls).toHaveLength(2);
  });

  it("caps the parsed entries at the requested limit", () => {
    const list = parseProxiflyList(
      "socks5://a.test:1080\nsocks5://b.test:1080\nsocks5://c.test:1080\n",
      2,
    );
    expect(list.urls).toEqual(["socks5://a.test:1080", "socks5://b.test:1080"]);
  });

  it("exposes the free list source", () => {
    expect(PROXIFLY_FREE_LIST_URL).toMatch(/^https:\/\//);
  });
});

describe("dispatcherFor", () => {
  it("returns nothing when there is no proxy", () => {
    expect(dispatcherFor(undefined)).toBeUndefined();
    expect(dispatcherFor("")).toBeUndefined();
  });

  it("builds a reusable dispatcher per proxy URL", () => {
    const first = dispatcherFor("socks5://user:pass@127.0.0.1:1080");
    const second = dispatcherFor("socks5://user:pass@127.0.0.1:1080");
    expect(first).toBeDefined();
    expect(second).toBe(first);

    const other = dispatcherFor("http://127.0.0.1:8081");
    expect(other).toBeDefined();
    expect(other).not.toBe(first);
  });
});

describe("adapter proxy wiring", () => {
  const catalog = findProvider("groq")!;

  function credential(proxyUrl?: string): Credential {
    return {
      id: "cred-1",
      providerId: "groq",
      secret: "gsk_test",
      description: "Main",
      proxyUrl,
      status: "healthy",
      createdAt: 0,
      updatedAt: 0,
      usage: emptyUsage(),
      consecutiveFailures: 0,
    };
  }

  const entry: ChainEntry = {
    id: "entry-1",
    chainId: "chain-1",
    providerId: "groq",
    model: "qwen/qwen3.8-27b",
    baseUrl: catalog.baseUrl,
    credentialIds: ["cred-1"],
    enabled: true,
    priority: 0,
    routingStrategy: "sequential",
    createdAt: 0,
    updatedAt: 0,
  };

  const request: ChatCompletionRequest = {
    model: "qwen/qwen3.8-27b",
    messages: [{ role: "user", content: "hi" }],
  };

  it("carries the credential's proxy onto the upstream request", () => {
    const adapter = new OpenAICompatibleAdapter(catalog);
    const spec = adapter.createRequest(
      entry,
      credential("socks5://user:pass@127.0.0.1:1080"),
      request,
    );
    expect(spec.proxyUrl).toBe("socks5://user:pass@127.0.0.1:1080");
  });

  it("leaves the proxy unset for direct-egress credentials", () => {
    const adapter = new OpenAICompatibleAdapter(catalog);
    expect(adapter.createRequest(entry, credential(), request).proxyUrl).toBeUndefined();
  });
});
