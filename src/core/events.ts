import { randomUUID } from "node:crypto";
import type { LiveRouteSnapshot } from "./types.js";

export type CokeyEventType =
  | "route.start"
  | "route.attempt"
  | "route.switch"
  | "chain.state"
  | "route.success"
  | "route.failure"
  | "credential.cooldown"
  | "credential.invalid"
  | "credential.verified"
  | "credential.updated"
  | "chain.updated"
  | "models.updated"
  | "content.updated";

export type CokeyEventLevel = "info" | "success" | "warn" | "error";

export type CokeyEventTopic = "route" | "chains" | "credentials" | "models" | "content";

export const COKEY_EVENT_TOPICS: readonly CokeyEventTopic[] = [
  "route",
  "chains",
  "credentials",
  "models",
  "content",
];

export function topicFor(type: CokeyEventType): CokeyEventTopic {
  if (type === "chain.state") return "route";
  if (type.startsWith("content.")) return "content";
  if (type.startsWith("models.")) return "models";
  if (type.startsWith("chain.")) return "chains";
  if (type.startsWith("credential.")) return "credentials";
  return "route";
}

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
      } catch {}
    }

    return event;
  }

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

  updateRoute(patch: Partial<LiveRouteSnapshot>): LiveRouteSnapshot {
    this.route = { ...this.route, ...patch, updatedAt: Date.now() };
    return this.route;
  }

  routeSnapshot(): LiveRouteSnapshot {
    return this.route;
  }

  finishRoute(active = false): LiveRouteSnapshot {
    return this.updateRoute({ active, attempts: this.route.attempts });
  }

  clear(): void {
    this.buffer.length = 0;
    this.route = { ...IDLE_ROUTE, updatedAt: Date.now() };
  }
}
