import { once } from "node:events";
import type { FastifyReply } from "fastify";
import {
  topicFor,
  COKEY_EVENT_TOPICS,
  type CokeyEvent,
  type CokeyEventTopic,
  type EventBus,
} from "../../core/events.js";

const HEARTBEAT_MS = 15_000;

export function parseTopics(raw: unknown): Set<CokeyEventTopic> | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const known = new Set<string>(COKEY_EVENT_TOPICS);
  const wanted = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => known.has(part)) as CokeyEventTopic[];
  return wanted.length > 0 ? new Set(wanted) : undefined;
}

export async function streamEvents(
  reply: FastifyReply,
  bus: EventBus,
  topics?: Set<CokeyEventTopic>,
): Promise<void> {
  reply.hijack();
  const raw = reply.raw;

  raw.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  raw.write("retry: 3000\n\n");

  const wanted = (event: CokeyEvent): boolean =>
    !topics || topics.size === 0 || topics.has(topicFor(event.type));

  const write = (payload: unknown): boolean => {
    if (raw.writableEnded) return false;
    return raw.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  write({
    kind: "snapshot",
    route: bus.routeSnapshot(),
    recent: bus.recent(50).filter(wanted),
    topics: topics ? [...topics] : [...COKEY_EVENT_TOPICS],
  });

  const unsubscribe = bus.subscribe((event: CokeyEvent) => {
    if (!wanted(event)) return;
    try {
      write({ kind: "event", event });
    } catch {}
  });

  const heartbeat = setInterval(() => {
    if (raw.writableEnded) return;
    raw.write(": ping\n\n");
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  const cleanup = (): void => {
    clearInterval(heartbeat);
    unsubscribe();
  };

  raw.on("close", cleanup);
  raw.on("error", cleanup);

  try {
    await once(raw, "close");
  } catch {
  } finally {
    cleanup();
    if (!raw.writableEnded) raw.end();
  }
}
