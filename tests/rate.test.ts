import { describe, expect, it } from "vitest";
import { RateTracker } from "../src/core/credentials/rate.js";

const T0 = 1_700_000_000_000;

describe("RateTracker", () => {
  it("returns an empty gauge for an unknown credential", () => {
    const tracker = new RateTracker();
    const snapshot = tracker.snapshot("missing", T0);
    expect(snapshot.requestsPerMinute).toBe(0);
    expect(snapshot.requestsLast5Minutes).toBe(0);
    expect(snapshot.sparkline).toHaveLength(12);
    expect(snapshot.sparkline.every((bucket) => bucket === 0)).toBe(true);
    expect(snapshot.lastRequestAt).toBeUndefined();
  });

  it("counts requests inside the trailing minute separately from the 5-minute window", () => {
    const tracker = new RateTracker();
    tracker.record("key", T0 - 10_000);
    tracker.record("key", T0 - 30_000);
    tracker.record("key", T0 - 90_000); // outside the minute, inside 5 minutes
    tracker.record("key", T0 - 400_000); // outside both windows

    const snapshot = tracker.snapshot("key", T0);
    expect(snapshot.requestsPerMinute).toBe(2);
    expect(snapshot.requestsLast5Minutes).toBe(3);
    // The newest observed request, even though an older one was recorded later.
    expect(snapshot.lastRequestAt).toBe(T0 - 10_000);
  });

  it("places requests in the right sparkline bucket, oldest first", () => {
    const tracker = new RateTracker();
    // 5s buckets: index 11 is the most recent bucket, index 0 the oldest.
    tracker.record("key", T0 - 1_000);
    tracker.record("key", T0 - 6_000);
    tracker.record("key", T0 - 6_500);

    const { sparkline } = tracker.snapshot("key", T0);
    expect(sparkline).toHaveLength(12);
    expect(sparkline[11]).toBe(1);
    expect(sparkline[10]).toBe(2);
    expect(sparkline.slice(0, 10).every((bucket) => bucket === 0)).toBe(true);
  });

  it("tracks rate limiting per credential and lets it expire", () => {
    const tracker = new RateTracker();
    tracker.recordRateLimited("limited", T0);
    tracker.record("other", T0);

    expect(tracker.snapshot("limited", T0).recentlyRateLimited).toBe(true);
    expect(tracker.snapshot("other", T0).recentlyRateLimited).toBe(false);

    // The flag is stale after the 5-minute window.
    expect(tracker.snapshot("limited", T0 + 6 * 60_000).recentlyRateLimited).toBe(false);
  });

  it("forgets a credential without touching the others", () => {
    const tracker = new RateTracker();
    tracker.record("a", T0);
    tracker.record("b", T0);

    tracker.forget("a");
    expect(tracker.snapshot("a", T0).requestsPerMinute).toBe(0);
    expect(tracker.snapshot("b", T0).requestsPerMinute).toBe(1);

    tracker.reset();
    expect(tracker.snapshot("b", T0).requestsPerMinute).toBe(0);
  });

  it("keeps two keys of one provider distinguishable", () => {
    const tracker = new RateTracker();
    for (let i = 0; i < 7; i += 1) tracker.record("busy-key", T0 - i * 1_000);
    tracker.record("idle-key", T0 - 50_000);

    expect(tracker.snapshot("busy-key", T0).requestsPerMinute).toBe(7);
    expect(tracker.snapshot("idle-key", T0).requestsPerMinute).toBe(1);
  });
});
