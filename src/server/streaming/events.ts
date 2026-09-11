import { once } from "node:events";
import type { FastifyReply } from "fastify";
import type { EventBus, CokeyEvent } from "../../core/events.js";

/** How often a comment frame is written to keep intermediaries from idling us out. */
const HEARTBEAT_MS = 15_000;

/**
 * Stream routing events to a browser.
 *
 * The first frame is a snapshot of the current route plus recent history, so a
 * client that connects mid-request still renders the right thing immediately
 * instead of waiting for the next event. Every later frame is one routing
 * event: an attempt, a key change, a model change, a cooldown.
 *
 * The response is deliberately unwritable by the router: a listener writes to
 * this socket from the routing hot path, so failures here are swallowed rather
 * than allowed to bubble into a request.
 */
export async function streamEvents(reply: FastifyReply, bus: EventBus): Promise<void> {
  reply.hijack();
  const raw = reply.raw;

  raw.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  raw.write("retry: 3000\n\n");

  const write = (payload: unknown): boolean => {
    if (raw.writableEnded) return false;
    return raw.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  write({ kind: "snapshot", route: bus.routeSnapshot(), recent: bus.recent(50) });

  const unsubscribe = bus.subscribe((event: CokeyEvent) => {
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
