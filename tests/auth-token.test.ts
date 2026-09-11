import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseClient } from "../src/core/db/database.js";
import { SettingsRepo } from "../src/core/db/settings.repo.js";
import { SettingsService } from "../src/core/settings.js";

function createSettingsService(): { service: SettingsService; dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "cokey-test-"));
  const db = new DatabaseClient(join(dir, "cokey.db"));
  const repo = new SettingsRepo(db);
  const service = new SettingsService(repo, { COKEY_DATA_DIR: dir });

  return {
    service,
    dir,
    cleanup() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe("SettingsService auth token", () => {
  it("returns undefined when no token is configured", () => {
    const { service, cleanup } = createSettingsService();
    try {
      expect(service.get().authToken).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it("generateAuthToken creates a 64-char hex token and persists it", () => {
    const { service, cleanup } = createSettingsService();
    try {
      const token = service.generateAuthToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(service.get().authToken).toBe(token);
    } finally {
      cleanup();
    }
  });

  it("generateAuthToken creates a different token each time (rotation)", () => {
    const { service, cleanup } = createSettingsService();
    try {
      const first = service.generateAuthToken();
      const second = service.generateAuthToken();
      expect(first).not.toBe(second);
      expect(service.get().authToken).toBe(second);
    } finally {
      cleanup();
    }
  });

  it("clearAuthToken removes the stored token", () => {
    const { service, cleanup } = createSettingsService();
    try {
      service.generateAuthToken();
      expect(service.get().authToken).toBeDefined();

      service.clearAuthToken();
      expect(service.get().authToken).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it("env override COKEY_AUTH_TOKEN wins over generated token", () => {
    const dir = mkdtempSync(join(tmpdir(), "cokey-test-"));
    const db = new DatabaseClient(join(dir, "cokey.db"));
    try {
      const repo = new SettingsRepo(db);
      const service = new SettingsService(repo, { COKEY_DATA_DIR: dir, COKEY_AUTH_TOKEN: "env-token-123" });

      const generatedToken = service.generateAuthToken();
      // The generated token is persisted, but env override should win on reload.
      void generatedToken;
      service.reload();
      expect(service.get().authToken).toBe("env-token-123");
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
