import { useEffect, useRef, useSyncExternalStore } from "react";
import type { CokeyEvent, LiveRouteSnapshot } from "./types.js";

export const DATA_TOPICS = ["chains", "credentials", "models", "content"] as const;

export type LiveTopic = "route" | "chains" | "credentials" | "models" | "content";

export function topicForEvent(type: CokeyEvent["type"]): LiveTopic {
  if (type === "chain.state") return "route";
  if (type.startsWith("content.")) return "content";
  if (type.startsWith("models.")) return "models";
  if (type.startsWith("chain.")) return "chains";
  if (type.startsWith("credential.")) return "credentials";
  return "route";
}

export interface LiveSnapshot {
  connected: boolean;

  revision: number;

  events: CokeyEvent[];

  last: CokeyEvent | null;

  route: LiveRouteSnapshot | null;
}

const EMPTY: LiveSnapshot = {
  connected: false,
  revision: 0,
  events: [],
  last: null,
  route: null,
};

const HISTORY = 40;

type Listener = () => void;

class LiveStore {
  private source: EventSource | undefined;
  private readonly listeners = new Set<Listener>();
  private snapshot: LiveSnapshot = EMPTY;

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    this.open();
    return () => {
      this.listeners.delete(listener);

      if (this.listeners.size === 0) this.close();
    };
  };

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

export function useLive(): LiveSnapshot {
  return useSyncExternalStore(liveStore.subscribe, liveStore.getSnapshot, () => EMPTY);
}

export function useLiveInvalidation(onChange: () => void, delayMs = 600): void {
  const { revision } = useLive();
  const handler = useRef(onChange);
  const timer = useRef<number | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (revision === 0) return;
    dirty.current = true;
    if (timer.current !== null) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (!dirty.current) return;
      dirty.current = false;
      handler.current();
    }, delayMs);
  }, [revision, delayMs]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    },
    [],
  );
}

export function describeLastEvent(last: CokeyEvent | null): string | null {
  if (!last) return null;
  return last.message;
}
