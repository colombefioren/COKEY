import { describe, expect, it } from "vitest";
import { MODELS_BY_PROVIDER } from "../src/catalog/models.js";
import { PROVIDER_CATALOG, findProvider } from "../src/catalog/providers.js";
import { modelAvailability } from "../src/core/models/availability.js";

function catalogFor(...ids: string[]) {
  return ids.map((id) => {
    const entry = findProvider(id);
    if (!entry) throw new Error(`Unknown provider in test: ${id}`);
    return entry;
  });
}

describe("modelAvailability", () => {
  it("marks a provider usable only when it has a healthy credential", () => {
    const catalog = catalogFor("groq", "openrouter");
    const counts = new Map([
      ["groq", { total: 2, healthy: 1 }],
      ["openrouter", { total: 1, healthy: 0 }],
    ]);
    const working = new Map([["groq", ["cred-1"]]]);

    const views = modelAvailability(catalog, counts, working);

    const groq = views.find((view) => view.providerId === "groq")!;
    expect(groq.available).toBe(true);
    expect(groq.healthyCount).toBe(1);
    expect(groq.credentialIds).toEqual(["cred-1"]);
    expect(groq.models.length).toBeGreaterThan(0);
    expect(groq.models.every((model) => model.selectable)).toBe(true);

    const openrouter = views.find((view) => view.providerId === "openrouter")!;
    expect(openrouter.available).toBe(false);
    expect(openrouter.models.every((model) => !model.selectable)).toBe(true);
  });

  it("lists models for availability-gating even with no credentials at all", () => {
    const views = modelAvailability(catalogFor("groq"), new Map(), new Map());
    const groq = views.find((view) => view.providerId === "groq")!;
    expect(groq.credentialCount).toBe(0);
    expect(groq.available).toBe(false);
    expect(groq.models.length).toBe(MODELS_BY_PROVIDER.groq!.length);
  });

  it("skips catalog providers that have no curated free models", () => {
    const noModels = findProvider("cerebras");
    if (!noModels) return; // Cerebras is optional in the catalog.
    const views = modelAvailability([noModels], new Map(), new Map());
    expect(views).toEqual([]);
  });

  it("sorts usable providers first while keeping the rest visible", () => {
    const catalog = catalogFor("groq", "openrouter", "cohere");
    const counts = new Map([["cohere", { total: 1, healthy: 1 }]]);
    const working = new Map([["cohere", ["cred-cohere"]]]);

    const views = modelAvailability(catalog, counts, working);
    const order = views.map((view) => (view.available ? "usable" : "locked"));
    const firstLocked = order.indexOf("locked");
    expect(order.slice(0, firstLocked).every((value) => value === "usable")).toBe(true);
    expect(order).toContain("locked");
  });

  it("keeps every curated model addressable by its provider", () => {
    const missing = Object.keys(MODELS_BY_PROVIDER).filter((id) => !findProvider(id));
    expect(missing).toEqual([]);
  });

  it("keeps the shipped catalog free-tier honest", () => {
    // Every provider in the catalog must be one a user can actually connect.
    for (const provider of PROVIDER_CATALOG) {
      expect(provider.baseUrl).toMatch(/^https?:\/\//);
      expect(provider.credentialFields).toContain("secret");
    }
  });
});
