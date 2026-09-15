export interface SseEvent {
  event?: string;
  data: string;
}

const decoder = new TextDecoder();

export async function* iterateSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SseEvent, void, void> {
  const reader = body.getReader();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = findBoundary(buffer);
      while (boundary !== -1) {
        const rawFrame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + boundaryLength(buffer, boundary));
        const parsed = parseFrame(rawFrame);
        if (parsed) yield parsed;
        boundary = findBoundary(buffer);
      }
    }
    const tail = parseFrame(buffer);
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}

export async function* iterateLines(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, void> {
  const reader = body.getReader();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index = buffer.indexOf("\n");
      while (index !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line) yield line;
        index = buffer.indexOf("\n");
      }
    }
    const tail = buffer.trim();
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}

function findBoundary(buffer: string): number {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");
  if (lf === -1) return crlf;
  if (crlf === -1) return lf;
  return Math.min(lf, crlf);
}

function boundaryLength(buffer: string, index: number): number {
  return buffer.startsWith("\r\n\r\n", index) ? 4 : 2;
}

function parseFrame(raw: string): SseEvent | undefined {
  const lines = raw.split(/\r?\n/);
  let event: string | undefined;
  const dataParts: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") dataParts.push(value);
  }

  if (dataParts.length === 0 && event === undefined) return undefined;
  return { event, data: dataParts.join("\n") };
}

export function sseFrame(data: unknown, event?: string): string {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  const prefix = event ? `event: ${event}\n` : "";
  return `${prefix}data: ${payload}\n\n`;
}

export const SSE_DONE = "data: [DONE]\n\n";

export function streamFrom(
  generator: AsyncGenerator<string, void, void>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await generator.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(value));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await generator.return?.();
    },
  });
}

export function chunkIdFactory(prefix = "chatcmpl-cokey"): () => string {
  let counter = 0;
  const seed = Math.random().toString(36).slice(2, 10);
  return () => `${prefix}-${seed}-${++counter}`;
}
