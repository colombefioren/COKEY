import { randomUUID } from "node:crypto";
import type { LiveRouteSnapshot } from "./types.js";

/**
 * Everything the UI needs to narrate a request as it happens.
 *
 * The gateway is a black box by design — a client sends one request and cannot
 * tell which of four keys answered, or whether a key silently rotated. These
 * events make the routing visible: which credential is live *right now*, and
 * every time the key or the model changed underneath the client.
 */
export type CokeyEventType =
  | "route.start"
  | "route.attempt"
  | "route.switch"
  /** A node or key changed underneath a client, phrased for a notification. */
  | "chain.state"
  | "route.success"
  | "route.failure"
  | "credential.cooldown"
  | "credential.invalid"
  | "credential.verified"
  | "credential.updated"
  | "chain.updated"
  | "models.updated";

export type CokeyEventLevel = "info" | "success" | "warn" | "error";

/** The routing target a switch moved away from. */
export interface RouteTarget {
  providerId?: string;
  model?: string;
  credentialId?: string;
  credentialDescription?: string;
}

export interface CokeyEvent {
  id: string;
  type: CokeyEventType;
  at: number;
  level: CokeyEventLevel;
  message: string;
  chainAlias?: string;
  providerId?: string;
  model?: string;
  credentialId?: string;
  credentialDescription?: string;
  /** Present on `route.switch`: what we left behind. */
  previous?: RouteTarget;
  classification?: string;
  status?: number;
  proxyLabel?: string;
  requestId?: string;
  data?: Record<string, unknown>;
}

export type CokeyEventInput = Omit<CokeyEvent, "id" | "at"> & { at?: number };

export type EventListener = (event: CokeyEvent) => void;

const IDLE_ROUTE: LiveRouteSnapshot = {
  active: false,
  fallback: false,
  attempts: 0,
  updatedAt: 0,
};

/**
 * In-process pub/sub plus the current route snapshot.
 *
 * Listeners are deliberately synchronous and never awaited: a slow SSE client
 * must not be able to stall a request that is mid-fallback. A bounded ring
 * buffer lets a UI that connects late still render recent history.
 */
export class EventBus {
  private readonly listeners = new Set<EventListener>();
  private readonly buffer: CokeyEvent[] = [];
  private route: LiveRouteSnapshot = { ...IDLE_ROUTE };

  constructor(private readonly capacity = 300) {}

  emit(input: CokeyEventInput): CokeyEvent {
    const event: CokeyEvent = { ...input, id: randomUUID(), at: input.at ?? Date.now() };

    this.buffer.push(event);
    if (this.buffer.length > this.capacity) {
      this.buffer.splice(0, this.buffer.length - this.capacity);
    }

    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        // A broken subscriber must never break routing.
      }
    }

    return event;
  }

  /** Most recent events, oldest first. */
  recent(limit = 50): CokeyEvent[] {
    if (limit <= 0) return [];
    return this.buffer.slice(Math.max(0, this.buffer.length - limit));
  }

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get subscriberCount(): number {
    return this.listeners.size;
  }

  /** Merge a patch into the live route snapshot. */
  updateRoute(patch: Partial<LiveRouteSnapshot>): LiveRouteSnapshot {
    this.route = { ...this.route, ...patch, updatedAt: Date.now() };
    return this.route;
  }

  routeSnapshot(): LiveRouteSnapshot {
    return this.route;
  }

  /** Return the route to idle, keeping the last model/key visible. */
  finishRoute(active = false): LiveRouteSnapshot {
    return this.updateRoute({ active, attempts: this.route.attempts });
  }

  clear(): void {
    this.buffer.length = 0;
    this.route = { ...IDLE_ROUTE, updatedAt: Date.now() };
  }
}
