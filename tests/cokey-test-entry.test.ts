import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cokey } from "../src/core/cokey.js";
import type { CokeyEvent } from "../src/core/events.js";

describe("Cokey.testEntry", () => {
  let dir: string;
  let cokey: Cokey;
  let server: Server | undefined;

  afterEach(async () => {
    cokey?.stop();
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("announces the credential state change so the live route updates without a refresh", async () => {
    server = createServer((_request, response) => {
      response.writeHead(429, { "content-type": "application/json", "retry-after": "60" });
      response.end(JSON.stringify({ error: { message: "rate limit exceeded" } }));
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const port = (server!.address() as { port: number }).port;

    dir = mkdtempSync(join(tmpdir(), "cokey-test-entry-"));
    cokey = new Cokey({ dataDir: dir, silent: true });
    cokey.settingsService.update({ allowPrivateEndpoints: true });

    const provider = cokey.addCustomEndpoint({
      displayName: "Test 429",
      baseUrl: `http://127.0.0.1:${port}/v1`,
      apiStyle: "openai",
      authScheme: "bearer",
      models: ["test-model"],
    });

    const credential = cokey.credentials.create({
      providerId: provider.id,
      secret: "sk-test",
      description: "key-1",
    });

    const chain = cokey.chains.createChain({ alias: "test-entry" });
    const entry = cokey.chains.addEntry({
      chainId: chain.id,
      providerId: provider.id,
      model: "test-model",
      baseUrl: `http://127.0.0.1:${port}/v1`,
      credentialIds: [credential.id],
    });

    const seen: CokeyEvent[] = [];
    cokey.events.subscribe((event) => seen.push(event));

    const result = await cokey.testEntry(entry.id);

    expect(result.ok).toBe(false);
    expect(cokey.credentials.get(credential.id)?.status).toBe("cooldown");
    expect(seen.some((event) => event.type === "credential.cooldown")).toBe(true);
  });
});