import { describe, expect, it } from "vitest";
import { createStreamUsageSniffer } from "../src/core/providers/transform.js";

const encoder = new TextEncoder();

describe("createStreamUsageSniffer", () => {
  it("captures usage from the final chunk of a well-formed SSE stream", () => {
    const sniffer = createStreamUsageSniffer();
    sniffer.onChunk(
      encoder.encode(
        `data: {"choices":[{"delta":{"content":"hi"}}]}\n\n` +
          `data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":34,"total_tokens":46}}\n\n` +
          `data: [DONE]\n\n`,
      ),
    );

    expect(sniffer.usage()).toEqual({ inputTokens: 12, outputTokens: 34 });
  });

  it("reassembles a usage frame split across chunk boundaries", () => {
    const sniffer = createStreamUsageSniffer();
    const frame = `data: {"usage":{"prompt_tokens":5,"completion_tokens":7}}\n\n`;
    const midpoint = Math.floor(frame.length / 2);
    sniffer.onChunk(encoder.encode(frame.slice(0, midpoint)));
    sniffer.onChunk(encoder.encode(frame.slice(midpoint)));

    expect(sniffer.usage()).toEqual({ inputTokens: 5, outputTokens: 7 });
  });

  it("returns undefined when no frame carries usage", () => {
    const sniffer = createStreamUsageSniffer();
    sniffer.onChunk(encoder.encode(`data: {"choices":[{"delta":{"content":"hi"}}]}\n\n`));
    sniffer.onChunk(encoder.encode(`data: [DONE]\n\n`));

    expect(sniffer.usage()).toBeUndefined();
  });

  it("ignores unparsable frames instead of throwing", () => {
    const sniffer = createStreamUsageSniffer();
    expect(() => sniffer.onChunk(encoder.encode(`data: not json\n\n`))).not.toThrow();
    expect(sniffer.usage()).toBeUndefined();
  });
});
