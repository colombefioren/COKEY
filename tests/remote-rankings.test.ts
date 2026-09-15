import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRemoteRankings } from "../src/core/remote-rankings.js";

function bundle(overrides: Record<string, unknown> = {}) {
  return {
    tiers: [{ name: "S", label: "Top tier", blurb: "The best." }],
    skill: [],
    rateLimit: [],
    combined: [],
    redundancy: [],
    dropList: [],
    bottomLine: "Use the top of the list.",
    disclaimer: "Numbers drift.",
    sources: [{ label: "Source", url: "https://example.test" }],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchRemoteRankings", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches and validates a well-formed bundle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(bundle())),
    );

    const result = await fetchRemoteRankings("https://example.test/rankings.json");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rankings.source).toBe("remote");
      expect(result.rankings.bottomLine).toBe("Use the top of the list.");
      expect(result.rankings.fetchedAt).toBeDefined();
    }
  });

  it("carries funFacts through when the bundle includes them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(bundle({ funFacts: ["Did you know?"] }))),
    );

    const result = await fetchRemoteRankings("https://example.test/rankings.json");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rankings.funFacts).toEqual(["Did you know?"]);
  });

  it("carries every French sibling field through when the bundle includes them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          bundle({
            tiers: [
              {
                name: "S",
                label: "Top tier",
                labelFr: "Palier du haut",
                blurb: "The best.",
                blurbFr: "Le meilleur.",
              },
            ],
            skill: [
              {
                model: "some-model",
                tierName: "S",
                reason: "Because.",
                reasonFr: "Parce que.",
              },
            ],
            rateLimit: [
              {
                providerId: "p",
                provider: "P",
                tier: 1,
                quota: "10/day",
                provenance: "operator",
                reliability: "solid",
                note: "Caveat.",
                noteFr: "Réserve.",
              },
            ],
            combined: [
              { rank: 1, providerId: "p", model: "m", why: "Good.", whyFr: "Bon.", tier: 1 },
            ],
            dropList: [{ provider: "p", reason: "Weak.", reasonFr: "Faible." }],
            bottomLineFr: "Utilisez le haut de la liste.",
            disclaimerFr: "Les chiffres varient.",
            funFacts: ["Fact"],
            funFactsFr: ["Anecdote"],
          }),
        ),
      ),
    );

    const result = await fetchRemoteRankings("https://example.test/rankings.json");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rankings.tiers[0]?.labelFr).toBe("Palier du haut");
    expect(result.rankings.tiers[0]?.blurbFr).toBe("Le meilleur.");
    expect(result.rankings.skill[0]?.reasonFr).toBe("Parce que.");
    expect(result.rankings.rateLimit[0]?.noteFr).toBe("Réserve.");
    expect(result.rankings.combined[0]?.whyFr).toBe("Bon.");
    expect(result.rankings.dropList[0]?.reasonFr).toBe("Faible.");
    expect(result.rankings.bottomLineFr).toBe("Utilisez le haut de la liste.");
    expect(result.rankings.disclaimerFr).toBe("Les chiffres varient.");
    expect(result.rankings.funFactsFr).toEqual(["Anecdote"]);
  });

  it("accepts a bundle with no funFacts field at all", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(bundle())),
    );

    const result = await fetchRemoteRankings("https://example.test/rankings.json");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rankings.funFacts).toBeUndefined();
  });

  it("refuses a non-https URL without making a request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchRemoteRankings("http://example.test/rankings.json");

    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports a non-200 response without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );

    const result = await fetchRemoteRankings("https://example.test/rankings.json");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("500");
  });

  it("reports invalid JSON without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("not json", { status: 200, headers: { "content-type": "text/plain" } }),
      ),
    );

    const result = await fetchRemoteRankings("https://example.test/rankings.json");
    expect(result.ok).toBe(false);
  });

  it("reports a bundle missing a required field without throwing", async () => {
    const { bottomLine: _bottomLine, ...incomplete } = bundle();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(incomplete)),
    );

    const result = await fetchRemoteRankings("https://example.test/rankings.json");
    expect(result.ok).toBe(false);
  });

  it("gives up on a request that never resolves", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            });
          }),
      ),
    );

    const result = await fetchRemoteRankings("https://example.test/rankings.json", 50);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Timed out");
  });
});
