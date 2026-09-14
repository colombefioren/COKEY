import { once } from "node:events";
import type { FastifyReply } from "fastify";
import {
  topicFor,
  COKEY_EVENT_TOPICS,
  type CokeyEvent,
  type CokeyEventTopic,
  type EventBus,
} from "../../core/events.js";

/** How often a comment frame is written to keep intermediaries from idling us out. */
const HEARTBEAT_MS = 15_000;

/**
 * Read a `?topics=` query value into the set of topics to stream.
 *
 * Returns `undefined` for "everything", which is the default, so a client that
 * has not been updated keeps working. Unknown names are dropped rather than
 * rejected: a subscriber asking for a topic this build does not have should get
 * its other topics, not a 400.
 */
export function parseTopics(raw: unknown): Set<CokeyEventTopic> | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const known = new Set<string>(COKEY_EVENT_TOPICS);
  const wanted = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => known.has(part)) as CokeyEventTopic[];
  return wanted.length > 0 ? new Set(wanted) : undefined;
}

/**
 * Stream routing events to a browser.
 *
 * The first frame is a snapshot of the current route plus recent history, so a
 * client that connects mid-request still renders the right thing immediately
 * instead of waiting for the next event. Every later frame is one routing
 * event: an attempt, a key change, a model change, a cooldown.
 *
 * `topics` narrows the stream. A UI that only needs to know when stored data
 * changed subscribes to `credentials,models,chains` and is never woken by the
 * per-attempt chatter of a request in flight, which is what makes a single
 * always-open connection cheap enough to leave running.
 *
 * The response is deliberately unwritable by the router: a listener writes to
 * this socket from the routing hot path, so failures here are swallowed rather
 * than allowed to bubble into a request.
 */
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

  // The snapshot is filtered with the same rule as live events, so a
  // topic-scoped subscriber is not handed a backlog it did not ask for.
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
    } catch {
      // The client went away; the close handler will clean up.
    }
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
    // Hold the connection open until the client disconnects.
    await once(raw, "close");
  } catch {
    /* already gone */
  } finally {
    cleanup();
    if (!raw.writableEnded) raw.end();
  }
}
