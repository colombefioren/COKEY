import { describe, expect, it } from "vitest";
import {
  RETAIN_MISSING_MS,
  isTrustworthyListing,
  normaliseModelIds,
  reconcileModels,
} from "../src/core/models/discovery.js";
import type { ProviderModelRecord } from "../src/core/db/provider-models.repo.js";

const NOW = 1_700_000_000_000;

function record(model: string, overrides: Partial<ProviderModelRecord> = {}): ProviderModelRecord {
  return {
    providerId: "groq",
    model,
    curated: true,
    available: true,
    firstSeen: NOW - 10_000,
    lastSeen: NOW - 1_000,
    lastChecked: NOW - 1_000,
    ...overrides,
  };
}

describe("normaliseModelIds", () => {
  it("trims, drops empties and de-duplicates while keeping order", () => {
    expect(normaliseModelIds([" b ", "a", "", "  ", "b", "a", "c"])).toEqual(["b", "a", "c"]);
  });

  it("returns an empty list for an empty input", () => {
    expect(normaliseModelIds([])).toEqual([]);
  });
});

describe("isTrustworthyListing", () => {
  it("refuses an empty listing", () => {
    // A 200 with [] is a scoped key, a deploy or a cached edge answer — never
    // evidence that a provider retired everything.
    expect(isTrustworthyListing([])).toBe(false);
  });

  it("accepts any non-empty listing", () => {
    expect(isTrustworthyListing(["a"])).toBe(true);
  });
});

describe("reconcileModels", () => {
  it("adds a curated model it had never seen, without calling it uncurated", () => {
    const { records, changes } = reconcileModels({
      providerId: "groq",
      curated: ["model-a"],
      discovered: ["model-a"],
      previous: [],
      now: NOW,
    });

    expect(changes.added).toEqual(["model-a"]);
    expect(changes.uncurated).toEqual([]);
    expect(changes.stale).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      model: "model-a",
      curated: true,
      available: true,
      firstSeen: NOW,
      lastSeen: NOW,
    });
  });

  it("flags a discovered model the curated catalog does not list as uncurated", () => {
    const { records, changes } = reconcileModels({
      providerId: "groq",
      curated: [],
      discovered: ["surprise/model"],
      previous: [],
      now: NOW,
    });

    expect(changes.added).toEqual(["surprise/model"]);
    expect(changes.uncurated).toEqual(["surprise/model"]);
    expect(records[0]!.curated).toBe(false);
  });

  it("retires a model that stopped being returned but keeps its history", () => {
    const { records, changes } = reconcileModels({
      providerId: "groq",
      curated: ["model-a", "model-b"],
      discovered: ["model-a"],
      previous: [record("model-a"), record("model-b")],
      now: NOW,
    });

    expect(changes.removed).toEqual(["model-b"]);
    expect(changes.stale).toEqual(["model-b"]);
    expect(changes.pruned).toBe(0);

    const retired = records.find((entry) => entry.model === "model-b")!;
    expect(retired.available).toBe(false);
    // Remembered, not forgotten: the original first-seen survives.
    expect(retired.firstSeen).toBe(NOW - 10_000);
    expect(retired.lastChecked).toBe(NOW);
  });

  it("forgets a model that has been missing longer than the retention window", () => {
    const { records, changes } = reconcileModels({
      providerId: "groq",
      curated: [],
      discovered: ["model-a"],
      previous: [record("model-a"), record("model-old", { lastSeen: NOW - RETAIN_MISSING_MS - 1 })],
      now: NOW,
    });

    expect(changes.pruned).toBe(1);
    expect(records.map((entry) => entry.model)).toEqual(["model-a"]);
  });

  it("reports a model that came back as restored rather than added", () => {
    const { changes } = reconcileModels({
      providerId: "groq",
      curated: ["model-a"],
      discovered: ["model-a"],
      previous: [record("model-a", { available: false })],
      now: NOW,
    });

    expect(changes.restored).toEqual(["model-a"]);
    expect(changes.added).toEqual([]);
    expect(changes.unchanged).toBe(0);
  });

  it("names every catalogued model the provider did not return", () => {
    const { changes } = reconcileModels({
      providerId: "groq",
      curated: ["kept", "gone-1", "gone-2"],
      discovered: ["kept"],
      previous: [],
      now: NOW,
    });

    expect(changes.stale).toEqual(["gone-1", "gone-2"]);
  });

  it("is idempotent: re-running the same listing changes nothing", () => {
    const first = reconcileModels({
      providerId: "groq",
      curated: ["model-a", "model-b"],
      discovered: ["model-a", "model-b", "extra"],
      previous: [],
      now: NOW,
    });

    const second = reconcileModels({
      providerId: "groq",
      curated: ["model-a", "model-b"],
      discovered: ["model-a", "model-b", "extra"],
      previous: first.records,
      now: NOW + 60_000,
    });

    expect(second.changes.added).toEqual([]);
    expect(second.changes.restored).toEqual([]);
    expect(second.changes.removed).toEqual([]);
    expect(second.changes.pruned).toBe(0);
    expect(second.changes.unchanged).toBe(3);
    // firstSeen is set once and never moves.
    expect(second.records.every((entry) => entry.firstSeen === NOW)).toBe(true);
  });

  it("keeps a curated label once earned, even if the catalog list changes", () => {
    const { records } = reconcileModels({
      providerId: "groq",
      curated: ["now-unlisted"],
      discovered: ["kept"],
      previous: [record("kept", { curated: true })],
      now: NOW,
    });

    expect(records.find((entry) => entry.model === "kept")!.curated).toBe(true);
  });

  it("deduplicates a provider that returns the same model twice", () => {
    const { records, changes } = reconcileModels({
      providerId: "groq",
      curated: [],
      discovered: ["dup", "dup", " dup "],
      previous: [],
      now: NOW,
    });

    expect(records).toHaveLength(1);
    expect(changes.added).toEqual(["dup"]);
  });
});
