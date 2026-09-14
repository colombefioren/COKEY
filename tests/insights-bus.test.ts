import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  reportInsightAttempt,
  reportInsightFailure,
  resetInsightTracking,
  subscribeInsights,
  type InsightSignal,
} from "../src/web/insights-bus.js";

describe("insights bus", () => {
  beforeEach(() => {
    resetInsightTracking();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits a failure signal with the given classification", () => {
    const received: InsightSignal[] = [];
    const unsubscribe = subscribeInsights((signal) => received.push(signal));

    reportInsightFailure("credential_invalid");

    expect(received).toEqual([{ kind: "failure", classification: "credential_invalid" }]);
    unsubscribe();
  });

  it("never emits a failure signal without a classification", () => {
    const received: InsightSignal[] = [];
    subscribeInsights((signal) => received.push(signal));

    reportInsightFailure(undefined);

    expect(received).toEqual([]);
  });

  it("stops delivering to a listener once unsubscribed", () => {
    const received: InsightSignal[] = [];
    const unsubscribe = subscribeInsights((signal) => received.push(signal));
    unsubscribe();

    reportInsightFailure("network_error");

    expect(received).toEqual([]);
  });

  it("fires a bulk signal once five attempts land inside the window", () => {
    const received: InsightSignal[] = [];
    subscribeInsights((signal) => received.push(signal));

    for (let i = 0; i < 4; i++) reportInsightAttempt("credential");
    expect(received).toEqual([]);

    reportInsightAttempt("credential");
    expect(received).toEqual([{ kind: "bulk", area: "credential" }]);
  });

  it("does not re-fire a bulk signal for the same area inside the cooldown", () => {
    const received: InsightSignal[] = [];
    subscribeInsights((signal) => received.push(signal));

    for (let i = 0; i < 5; i++) reportInsightAttempt("model");
    for (let i = 0; i < 5; i++) reportInsightAttempt("model");

    expect(received).toEqual([{ kind: "bulk", area: "model" }]);
  });

  it("tracks each area's burst independently", () => {
    const received: InsightSignal[] = [];
    subscribeInsights((signal) => received.push(signal));

    for (let i = 0; i < 5; i++) reportInsightAttempt("credential");
    for (let i = 0; i < 5; i++) reportInsightAttempt("model");

    expect(received).toEqual([
      { kind: "bulk", area: "credential" },
      { kind: "bulk", area: "model" },
    ]);
  });

  it("does not count attempts that fall outside the burst window", () => {
    const received: InsightSignal[] = [];
    subscribeInsights((signal) => received.push(signal));

    for (let i = 0; i < 4; i++) reportInsightAttempt("credential");
    vi.advanceTimersByTime(60_000);
    reportInsightAttempt("credential");

    expect(received).toEqual([]);
  });
});
