import { describe, expect, it } from "vitest";
import { MODELS_BY_PROVIDER, modelsForProvider } from "../src/catalog/models.js";
import { PROVIDER_CATALOG, findProvider } from "../src/catalog/providers.js";
import { modelAvailability, staleCuratedModels } from "../src/core/models/availability.js";
import type { ProviderModelRecord } from "../src/core/db/provider-models.repo.js";

function observed(model: string, available = true): ProviderModelRecord {
  return {
    providerId: "groq",
    model,
    curated: true,
    available,
    firstSeen: 1,
    lastSeen: 2,
    lastChecked: 2,
  };
}

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
    if (!noModels) return;
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
    for (const provider of PROVIDER_CATALOG) {
      expect(provider.baseUrl).toMatch(/^https?:\/\//);
      expect(provider.credentialFields).toContain("secret");
    }
  });
});

describe("staleCuratedModels", () => {
  it("says nothing when the provider has never been checked", () => {
    expect(staleCuratedModels(["a", "b"], [])).toEqual([]);
  });

  it("returns the curated models with no observed row", () => {
    expect(staleCuratedModels(["a", "b", "c"], [observed("a"), observed("b")])).toEqual(["c"]);
  });

  it("returns the curated models observed as unavailable", () => {
    expect(staleCuratedModels(["a", "b"], [observed("a"), observed("b", false)])).toEqual(["b"]);
  });
});

describe("modelAvailability with an observed inventory", () => {
  it("hides a curated model the provider stopped returning", () => {
    const curated = modelsForProvider("groq");
    const retired = curated[1]!;

    const inventory = new Map([
      ["groq", curated.map((spec) => observed(spec.id, spec.id !== retired.id))],
    ]);

    const views = modelAvailability(catalogFor("groq"), new Map(), new Map(), inventory);
    const groq = views.find((view) => view.providerId === "groq")!;

    expect(groq.models.map((model) => model.id)).not.toContain(retired.id);
    expect(groq.staleModels).toEqual([retired.id]);
    expect(groq.counts.curated).toBe(curated.length);
    expect(groq.counts.live).toBe(curated.length - 1);
    expect(groq.inventoryCheckedAt).toBe(2);
  });

  it("lists a model the provider serves that the catalog never annotated", () => {
    const inventory = new Map([["groq", [observed("groq/brand-new-9000")]]]);

    const views = modelAvailability(catalogFor("groq"), new Map(), new Map(), inventory);
    const groq = views.find((view) => view.providerId === "groq")!;

    const discovered = groq.models.find((model) => model.id === "groq/brand-new-9000")!;
    expect(discovered).toBeDefined();
    expect(discovered.curated).toBe(false);
    expect(discovered.live).toBe(true);
    expect(groq.counts.discovered).toBe(1);

    expect(groq.staleModels.length).toBe(modelsForProvider("groq").length);
  });

  it("still refuses to make a model selectable without a verified key", () => {
    const inventory = new Map([["groq", [observed("groq/brand-new-9000")]]]);
    const views = modelAvailability(catalogFor("groq"), new Map(), new Map(), inventory);
    const groq = views.find((view) => view.providerId === "groq")!;
    expect(groq.models.every((model) => !model.selectable)).toBe(true);
  });
});
