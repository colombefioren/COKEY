import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveFromPassphrase, resolveMasterKey } from "../src/core/crypto/keyring.js";

describe("deriveFromPassphrase", () => {
  it("derives a 32-byte key without throwing", () => {
    const key = deriveFromPassphrase("correct horse battery staple", "/tmp/cokey-test-dir");
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it("is deterministic for the same passphrase and data dir", () => {
    const a = deriveFromPassphrase("hunter2", "/tmp/cokey-test-dir");
    const b = deriveFromPassphrase("hunter2", "/tmp/cokey-test-dir");
    expect(a.equals(b)).toBe(true);
  });

  it("differs for a different data dir", () => {
    const a = deriveFromPassphrase("hunter2", "/tmp/cokey-test-dir-a");
    const b = deriveFromPassphrase("hunter2", "/tmp/cokey-test-dir-b");
    expect(a.equals(b)).toBe(false);
  });
});

describe("resolveMasterKey (keyfile)", () => {
  function withTempDir<T>(fn: (dir: string) => T): T {
    const dir = mkdtempSync(join(tmpdir(), "cokey-keyring-test-"));
    try {
      return fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("creates a 32-byte keyfile on first use and reuses it afterwards", () => {
    withTempDir((dir) => {
      const first = resolveMasterKey({ dataDir: dir, disableKeychain: true });
      expect(first.kind).toBe("keyfile");
      expect(first.key.length).toBe(32);

      const second = resolveMasterKey({ dataDir: dir, disableKeychain: true });
      expect(second.key.equals(first.key)).toBe(true);
    });
  });

  it("reads a keyfile that already exists instead of overwriting it", () => {
    withTempDir((dir) => {
      const keyPath = join(dir, "master.key");
      const preExisting = "11".repeat(32);
      writeFileSync(keyPath, preExisting, { mode: 0o600 });

      const resolved = resolveMasterKey({ dataDir: dir, disableKeychain: true });
      expect(resolved.key.toString("hex")).toBe(preExisting);
      expect(readFileSync(keyPath, "utf8")).toBe(preExisting);
    });
  });
});
