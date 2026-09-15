import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseQuota, parseResetValue } from "../src/core/quota/parse.js";

describe("parseQuota", () => {
  it("returns unavailable when a response carries no rate-limit headers", () => {
    const result = parseQuota(new Headers());
    expect(result).toEqual({ available: false, source: "unknown" });
  });

  it("reads the standard OpenAI-shaped headers", () => {
    const headers = new Headers({
      "x-ratelimit-remaining-requests": "42",
      "x-ratelimit-remaining-tokens": "1000",
      "x-ratelimit-limit-requests": "60",
    });

    const result = parseQuota(headers);

    expect(result.available).toBe(true);
    expect(result.source).toBe("provider");
    expect(result.requestsRemaining).toBe(42);
    expect(result.tokensRemaining).toBe(1000);
    expect(result.requestsPerMinute).toBe(60);
  });

  it("reads a plain lowercase-keyed object the same as a Headers instance", () => {
    const result = parseQuota({ "x-ratelimit-remaining-requests": "5" });
    expect(result.available).toBe(true);
    expect(result.requestsRemaining).toBe(5);
  });

  it("ignores a non-numeric header instead of throwing", () => {
    const result = parseQuota(new Headers({ "x-ratelimit-remaining-requests": "unlimited" }));
    expect(result).toEqual({ available: false, source: "unknown" });
  });
});

describe("parseResetValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats a single unit as a relative duration", () => {
    expect(parseResetValue("30s")).toBe(Date.now() + 30_000);
    expect(parseResetValue("500ms")).toBe(Date.now() + 500);
    expect(parseResetValue("2h")).toBe(Date.now() + 2 * 3_600_000);
  });

  it("sums a compound duration across mixed units", () => {
    expect(parseResetValue("1m30s")).toBe(Date.now() + 90_000);
    expect(parseResetValue("1h30m")).toBe(Date.now() + 90 * 60_000);
  });

  it("treats a small bare integer as relative seconds", () => {
    expect(parseResetValue("45")).toBe(Date.now() + 45_000);
  });

  it("treats a large bare integer as an epoch timestamp", () => {
    const epoch = Date.now() + 10_000_000_000;
    expect(parseResetValue(String(epoch))).toBe(epoch);
  });

  it("falls back to Date.parse for an ISO timestamp", () => {
    const iso = "2026-06-01T00:00:00.000Z";
    expect(parseResetValue(iso)).toBe(Date.parse(iso));
  });

  it("returns undefined for gibberish", () => {
    expect(parseResetValue("not-a-duration")).toBeUndefined();
  });
});
