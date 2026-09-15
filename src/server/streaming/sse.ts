import { once } from "node:events";
import type { FastifyReply } from "fastify";

export const STREAM_HEADERS: Record<string, string> = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
};

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
  } finally {
    try {
      await reader.cancel();
    } catch {}
    raw.end();
  }
}

export function endWithError(reply: FastifyReply, status: number, payload: unknown): void {
  reply.hijack();
  reply.raw.writeHead(status, { "content-type": "application/json" });
  reply.raw.end(JSON.stringify(payload));
}

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
