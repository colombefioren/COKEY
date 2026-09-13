import { useEffect, useRef, useSyncExternalStore } from "react";
import type { CokeyEvent, LiveRouteSnapshot } from "./types.js";

/**
 * The live data store.
 *
 * Everything on the dashboard that shows stored state — key health, chain
 * topology, the model catalog — used to change only when the user reloaded or a
 * timer fired. That is wrong for a gateway: a key can verify in one tab and a
 * chain can be edited in another, and a dashboard that is thirty seconds behind
 * its own database is a dashboard nobody trusts.
 *
 * So the gateway's event bus is the source of truth. This module holds one
 * connection to it for the whole application and hands React an incrementing
 * revision whenever stored data changed.
 *
 * Three decisions worth naming:
 *
 *   1. ONE connection. The stream is created on the first subscriber and closed
 *      with the last. Ten components wanting live data still cost one socket,
 *      and a route change does not tear down a connection that is working.
 *
 *   2. Narrow topics. The UI subscribes to `chains,credentials,models,content`.
 *      Route events fire several times per request; invalidating cached reads on
 *      each one would refetch the whole dashboard on every attempt of every
 *      request in flight. The routing narration has its own subscriber in
 *      LiveStatus, which wants exactly that chatter.
 *
 *   3. EventSource already reconnects. The browser retries on its own, so this
 *      store does not implement a backoff loop — it only tracks whether the
 *      connection is currently open, so the UI can say so honestly.
 */

/**
 * The subjects whose events mean stored data changed.
 *
 * `content` is included because the curated dossiers, terms and ranking boards
 * are read from a directory that can change while the dashboard is open — a
 * `git pull` in the content checkout should not require a page reload to be
 * seen.
 */
export const DATA_TOPICS = ["chains", "credentials", "models", "content"] as const;

export type LiveTopic = "route" | "chains" | "credentials" | "models" | "content";

/**
 * Which topic an event belongs to.
 *
 * Mirrors the server's rule in `core/events.ts`, including the one exception:
 * `chain.state` is phrased as a chain notification but is emitted from the
 * routing hot path to narrate a request, so it belongs with the route.
 */
export function topicForEvent(type: CokeyEvent["type"]): LiveTopic {
  if (type === "chain.state") return "route";
  if (type.startsWith("content.")) return "content";
  if (type.startsWith("models.")) return "models";
  if (type.startsWith("chain.")) return "chains";
  if (type.startsWith("credential.")) return "credentials";
  return "route";
}

export interface LiveSnapshot {
  /** True while the stream is open. */
  connected: boolean;
  /** Increments on every event on a subscribed topic. */
  revision: number;
  /** The most recent events, newest last. Bounded. */
  events: CokeyEvent[];
  /** The last event, for a status line. */
  last: CokeyEvent | null;
  /** The route snapshot the server sent on connect. */
  route: LiveRouteSnapshot | null;
}

const EMPTY: LiveSnapshot = {
  connected: false,
  revision: 0,
  events: [],
  last: null,
  route: null,
};

/** How many events the store keeps for a status line. */
const HISTORY = 40;

type Listener = () => void;

class LiveStore {
  private source: EventSource | undefined;
  private readonly listeners = new Set<Listener>();
  private snapshot: LiveSnapshot = EMPTY;

  /** Stable bound subscribe, suitable for `useSyncExternalStore`. */
  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    this.open();
    return () => {
      this.listeners.delete(listener);
      // The last subscriber leaving closes the socket. An EventSource that
      // reconnects forever in a background tab is a leak, not a feature.
      if (this.listeners.size === 0) this.close();
    };
  };

  /** Stable bound snapshot reader, so React does not see a new object per read. */
  readonly getSnapshot = (): LiveSnapshot => this.snapshot;

  private emit(patch: Partial<LiveSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of [...this.listeners]) listener();
  }

  private open(): void {
    if (this.source || typeof window === "undefined" || !("EventSource" in window)) return;

    const url = `/api/events?topics=${DATA_TOPICS.join(",")}`;
    const source = new EventSource(url, { withCredentials: true });
    this.source = source;

    source.addEventListener("open", () => {
      this.emit({ connected: true });
    });

    source.addEventListener("error", () => {
      // EventSource reconnects on its own; only the indicator changes here.
      this.emit({ connected: false });
    });

    source.addEventListener("message", (message) => {
      let payload: unknown;
      try {
        payload = JSON.parse((message as MessageEvent<string>).data);
      } catch {
        return;
      }
      if (!payload || typeof payload !== "object") return;

      const frame = payload as { kind?: string; event?: CokeyEvent; route?: LiveRouteSnapshot };

      if (frame.kind === "snapshot") {
        this.emit({ connected: true, route: frame.route ?? null });
        return;
      }

      if (frame.kind !== "event" || !frame.event) return;

      const event = frame.event;
      const events = [...this.snapshot.events, event].slice(-HISTORY);
      this.emit({ events, last: event, revision: this.snapshot.revision + 1 });
    });
  }

  private close(): void {
    this.source?.close();
    this.source = undefined;
    if (this.snapshot.connected) this.emit({ connected: false });
  }
}

const liveStore = new LiveStore();

/** The whole live snapshot. Re-renders the caller on any subscribed event. */
export function useLive(): LiveSnapshot {
  return useSyncExternalStore(liveStore.subscribe, liveStore.getSnapshot, () => EMPTY);
}

/**
 * Run `onChange` when the gateway reports that stored data changed.
 *
 * Coalesced, deliberately. A burst of events — a provider retiring eight models
 * at once during a refresh, or a sweep cooling down a dozen keys — would
 * otherwise trigger one full refetch per event, turning a single user action
 * into a stampede of API calls. The trailing edge is what matters here: after
 * the burst settles, refetch once.
 *
 * `onChange` is held in a ref so a caller that passes an inline arrow does not
 * restart the timer on every render, which would mean the debounce never fires.
 */
export function useLiveInvalidation(onChange: () => void, delayMs = 600): void {
  const { revision } = useLive();
  const handler = useRef(onChange);

  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (revision === 0) return;
    const timer = window.setTimeout(() => handler.current(), delayMs);
    return () => window.clearTimeout(timer);
  }, [revision, delayMs]);
}

/**
 * A human summary of the most recent change, for a status line.
 *
 * Returns null when nothing has happened yet, so a caller can render nothing
 * rather than an empty sentence.
 */
export function describeLastEvent(last: CokeyEvent | null): string | null {
  if (!last) return null;
  return last.message;
}
