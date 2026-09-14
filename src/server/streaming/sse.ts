import { once } from "node:events";
import type { FastifyReply } from "fastify";

/**
 * Headers for a proxied event stream.
 *
 * `X-Accel-Buffering: no` matters behind nginx; `no-transform` stops proxies
 * from rewriting chunks, which would corrupt SSE framing.
 */
export const STREAM_HEADERS: Record<string, string> = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
};

/**
 * Take over the socket and forward a byte stream chunk-by-chunk.
 *
 * The upstream response is never buffered in full: each chunk is written as it
 * arrives, and `await once(raw, "drain")` applies backpressure so a slow client
 * cannot make COKEY hold an unbounded amount of memory.
 */
export async function pipeStream(
  reply: FastifyReply,
  body: ReadableStream<Uint8Array>,
  options: { headers?: Record<string, string>; onChunk?: (chunk: Uint8Array) => void } = {},
): Promise<void> {
  reply.hijack();
  const raw = reply.raw;

  raw.writeHead(200, {
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    ...STREAM_HEADERS,
    ...options.headers,
  });

  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      options.onChunk?.(value);

      if (!raw.write(value)) {
        await once(raw, "drain");
      }
    }
  } catch {
    // The client disconnected or the upstream aborted; nothing useful to say.
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* already closed */
    }
    raw.end();
  }
}

/** End a hijacked response with a JSON body, used for late failures. */
export function endWithError(reply: FastifyReply, status: number, payload: unknown): void {
  reply.hijack();
  reply.raw.writeHead(status, { "content-type": "application/json" });
  reply.raw.end(JSON.stringify(payload));
}

/**
 * Return a stream that emits `prefix` first, then every chunk of `body`.
 *
 * Used to prepend a synthetic SSE event (e.g. a chain-state notice) before the
 * upstream bytes, without buffering the whole upstream stream.
 */
export function prependStream(
  prefix: Uint8Array,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  let sentPrefix = false;
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!sentPrefix) {
        sentPrefix = true;
        controller.enqueue(prefix);
        return;
      }
      const { done, value } = await reader.read();
      if (done) controller.close();
      else if (value) controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
