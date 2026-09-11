import { describe, expect, it, vi } from "vitest";
import { EventBus, type CokeyEvent } from "../src/core/events.js";

describe("EventBus", () => {
  it("stamps every event with an id and a timestamp", () => {
    const bus = new EventBus();
    const event = bus.emit({ type: "route.start", level: "info", message: "go" });
    expect(event.id).toBeTruthy();
    expect(event.at).toBeGreaterThan(0);
    expect(bus.recent()).toHaveLength(1);
  });

  it("returns recent events oldest-first and honours the limit", () => {
    const bus = new EventBus();
    bus.emit({ type: "route.attempt", level: "info", message: "one" });
    bus.emit({ type: "route.attempt", level: "info", message: "two" });
    bus.emit({ type: "route.attempt", level: "info", message: "three" });

    expect(bus.recent(2).map((event) => event.message)).toEqual(["two", "three"]);
    expect(bus.recent().map((event) => event.message)).toEqual(["one", "two", "three"]);
    expect(bus.recent(0)).toEqual([]);
  });

  it("keeps a bounded ring buffer", () => {
    const bus = new EventBus(3);
    for (let i = 0; i < 6; i += 1) {
      bus.emit({ type: "route.attempt", level: "info", message: `event-${i}` });
    }
    expect(bus.recent().map((event) => event.message)).toEqual([
      "event-3",
      "event-4",
      "event-5",
    ]);
  });

  it("notifies subscribers until they unsubscribe", () => {
    const bus = new EventBus();
    const seen: CokeyEvent[] = [];
    const unsubscribe = bus.subscribe((event) => seen.push(event));

    bus.emit({ type: "route.start", level: "info", message: "first" });
    expect(bus.subscriberCount).toBe(1);

    unsubscribe();
    bus.emit({ type: "route.start", level: "info", message: "second" });

    expect(seen.map((event) => event.message)).toEqual(["first"]);
    expect(bus.subscriberCount).toBe(0);
  });

  it("never lets a broken subscriber break routing", () => {
    const bus = new EventBus();
    const good = vi.fn();
    bus.subscribe(() => {
      throw new Error("subscriber exploded");
    });
    bus.subscribe(good);

    expect(() => bus.emit({ type: "route.attempt", level: "info", message: "still routed" })).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });

  it("tracks the live route snapshot and returns it to idle", () => {
    const bus = new EventBus();
    bus.updateRoute({
      active: true,
      chainAlias: "best",
      providerId: "groq",
      model: "qwen/qwen3.8-27b",
      credentialDescription: "Main",
      attempts: 0,
    });

    let route = bus.routeSnapshot();
    expect(route.active).toBe(true);
    expect(route.model).toBe("qwen/qwen3.8-27b");
    expect(route.updatedAt).toBeGreaterThan(0);

    route = bus.updateRoute({ active: false, lastOutcome: "success", attempts: 2 });
    expect(route.active).toBe(false);
    expect(route.lastOutcome).toBe("success");
    expect(route.attempts).toBe(2);
    // Merging must not drop the last known target.
    expect(route.credentialDescription).toBe("Main");

    bus.clear();
    expect(bus.routeSnapshot().active).toBe(false);
    expect(bus.recent()).toEqual([]);
  });
});
