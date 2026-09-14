import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ModelProbesRepo } from "../src/core/db/model-probes.repo.js";
import { createHarness, type Harness } from "./helpers/harness.js";

describe("ModelProbesRepo", () => {
  let harness: Harness;
  let repo: ModelProbesRepo;

  beforeEach(() => {
    harness = createHarness();
    repo = new ModelProbesRepo(harness.db);
  });

  afterEach(() => harness.cleanup());

  it("aggregates attempts, successes and average latency over successful probes only", () => {
    repo.record({
      providerId: "groq",
      model: "llama-3.3-70b",
      credentialId: "cred-1",
      ok: true,
      classification: "success",
      latencyMs: 400,
      checkedAt: 1,
    });
    repo.record({
      providerId: "groq",
      model: "llama-3.3-70b",
      credentialId: "cred-1",
      ok: false,
      classification: "network_error",
      latencyMs: 9000,
      checkedAt: 2,
    });
    repo.record({
      providerId: "groq",
      model: "llama-3.3-70b",
      credentialId: "cred-1",
      ok: true,
      classification: "success",
      latencyMs: 600,
      checkedAt: 3,
    });

    const [stats] = repo.allStats();
    expect(stats.providerId).toBe("groq");
    expect(stats.model).toBe("llama-3.3-70b");
    expect(stats.attempts).toBe(3);
    expect(stats.successes).toBe(2);
    expect(stats.successRate).toBeCloseTo(2 / 3);
    // Only the two successful attempts (400ms, 600ms) count toward latency —
    // the failed request's 9000ms never should.
    expect(stats.avgLatencyMs).toBe(500);
    expect(stats.lastCheckedAt).toBe(3);
    expect(stats.lastOk).toBe(true);
  });

  it("reports lastOk from the most recent attempt, not an arbitrary one", () => {
    repo.record({
      providerId: "groq",
      model: "m",
      ok: true,
      classification: "success",
      latencyMs: 100,
      checkedAt: 10,
    });
    repo.record({
      providerId: "groq",
      model: "m",
      ok: false,
      classification: "quota_exhausted",
      latencyMs: 50,
      checkedAt: 20,
    });

    const [stats] = repo.allStats();
    expect(stats.lastOk).toBe(false);
    expect(stats.lastCheckedAt).toBe(20);
  });

  it("leaves avgLatencyMs undefined when every attempt failed", () => {
    repo.record({
      providerId: "groq",
      model: "m",
      ok: false,
      classification: "network_error",
      latencyMs: 100,
      checkedAt: 1,
    });

    const [stats] = repo.allStats();
    expect(stats.successes).toBe(0);
    expect(stats.avgLatencyMs).toBeUndefined();
  });

  it("keeps separate providers and models apart", () => {
    repo.record({
      providerId: "groq",
      model: "m",
      ok: true,
      classification: "success",
      latencyMs: 100,
      checkedAt: 1,
    });
    repo.record({
      providerId: "cerebras",
      model: "m",
      ok: true,
      classification: "success",
      latencyMs: 100,
      checkedAt: 1,
    });

    expect(repo.allStats()).toHaveLength(2);
  });
});
