import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RequestsRepo, type InsertRequestLogInput } from "../src/core/db/requests.repo.js";
import { createHarness, type Harness } from "./helpers/harness.js";

let h: Harness;

beforeEach(() => {
  h = createHarness();
});

afterEach(() => {
  h.cleanup();
});

function entry(at: number): InsertRequestLogInput {
  return {
    id: `req-${at}-${Math.random()}`,
    at,
    chainAlias: "best",
    entryId: "entry-1",
    providerId: "groq",
    model: "qwen",
    credentialId: "cred-1",
    credentialDescription: "key-1",
    latencyMs: 10,
    outcome: "success",
    classification: "success",
    fallback: false,
    attempts: 1,
    stream: false,
  };
}

describe("RequestsRepo pruning", () => {
  it("does not prune on every single insert, only every Nth", () => {
    const repo = new RequestsRepo(h.db, 5);
    // maxRows=5 would normally cap the table at 5 rows if prune ran on every
    // insert; with periodic pruning it should be allowed to grow past that
    // in between prune cycles.
    for (let i = 0; i < 10; i++) repo.insert(entry(Date.now() + i));

    expect(repo.count()).toBeGreaterThan(5);
  });

  it("eventually enforces maxRows once enough inserts have accumulated", () => {
    const repo = new RequestsRepo(h.db, 5);
    for (let i = 0; i < 50; i++) repo.insert(entry(Date.now() + i));

    expect(repo.count()).toBeLessThanOrEqual(5);
  });

  it("drops usage_daily rows older than the retention window", () => {
    const repo = new RequestsRepo(h.db);
    const oldDay = new Date(Date.now() - 200 * 86_400_000).getTime();
    const recentDay = Date.now();

    repo.insert(entry(oldDay));
    repo.insert(entry(recentDay));

    repo.pruneUsageDaily(90);

    const rows = repo.rollupSince("2000-01-01");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.day).toBe(new Date(recentDay).toISOString().slice(0, 10));
  });
});
