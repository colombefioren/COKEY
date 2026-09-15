import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cokey } from "../src/core/cokey.js";

/**
 * `guidance()` caps the notices it hands the dashboard at 12 so a user with
 * dozens of broken keys sees the worst few, not a wall of rows - but the
 * severity summary badge is a different promise: it has to count everything,
 * because a summary computed from the already-capped list would silently
 * drop notices that got crowded out by a pile of higher-severity ones,
 * telling the user their warnings are gone when they were only hidden.
 */
describe("Cokey.guidance", () => {
  let dir: string;
  let cokey: Cokey;

  afterEach(() => {
    cokey?.stop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("summarizes every notice, not just the ones that fit under the display cap", () => {
    dir = mkdtempSync(join(tmpdir(), "cokey-guidance-test-"));
    cokey = new Cokey({ dataDir: dir, silent: true });

    const chain = cokey.chains.createChain({ alias: "overflow" });
    const unkeyedCount = 15;
    for (let i = 0; i < unkeyedCount; i++) {
      cokey.chains.addEntry({
        chainId: chain.id,
        providerId: "groq",
        model: "qwen/qwen3.8-27b",
        baseUrl: "https://api.groq.com/openai/v1",
        credentialIds: [],
      });
    }

    const { notices, summary } = cokey.guidance();

    expect(notices.length).toBe(12);
    expect(summary.critical).toBe(unkeyedCount);
  });
});
