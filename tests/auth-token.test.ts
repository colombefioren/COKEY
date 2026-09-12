import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseClient } from "../src/core/db/database.js";
import { SettingsRepo } from "../src/core/db/settings.repo.js";
import { SettingsService, DEFAULT_ADMIN_PASSWORD } from "../src/core/settings.js";
import { ApiKeyService } from "../src/core/api-keys.js";
import { ApiKeysRepo } from "../src/core/db/api-keys.repo.js";

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

describe("SettingsService admin password", () => {
  it("defaults to coco-the-best and is not locked", () => {
    const { service, cleanup } = createSettingsService();
    try {
      expect(service.password()).toBe(DEFAULT_ADMIN_PASSWORD);
      expect(service.passwordLocked()).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("verifies the default password", () => {
    const { service, cleanup } = createSettingsService();
    try {
      expect(service.verifyPassword(DEFAULT_ADMIN_PASSWORD)).toBe(true);
      expect(service.verifyPassword("wrong")).toBe(false);
      expect(service.verifyPassword("")).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("setPassword stores the new password and locks it", () => {
    const { service, cleanup } = createSettingsService();
    try {
      service.setPassword("hunter2");
      expect(service.password()).toBe("hunter2");
      expect(service.passwordLocked()).toBe(true);
      expect(service.verifyPassword("hunter2")).toBe(true);
      expect(service.verifyPassword(DEFAULT_ADMIN_PASSWORD)).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("rejects changing the password once locked", () => {
    const { service, cleanup } = createSettingsService();
    try {
      service.setPassword("first-choice");
      expect(() => service.setPassword("second-choice")).toThrow();
      expect(service.password()).toBe("first-choice");
    } finally {
      cleanup();
    }
  });

  it("rejects a too-short password", () => {
    const { service, cleanup } = createSettingsService();
    try {
      expect(() => service.setPassword("abc")).toThrow();
      expect(service.passwordLocked()).toBe(false);
    } finally {
      cleanup();
    }
  });
});

describe("ApiKeyService", () => {
  function createService(): { service: ApiKeyService; cleanup: () => void } {
    const dir = mkdtempSync(join(tmpdir(), "cokey-test-"));
    const db = new DatabaseClient(join(dir, "cokey.db"));
    const service = new ApiKeyService(new ApiKeysRepo(db));
    return {
      service,
      cleanup() {
        db.close();
        rmSync(dir, { recursive: true, force: true });
      },
    };
  }

  it("creates a key with a stable prefix and returns the secret once", () => {
    const { service, cleanup } = createService();
    try {
      const created = service.create("OpenCode");
      expect(created.key).toMatch(/^ck-[0-9a-f]{48}$/);
      expect(created.view.name).toBe("OpenCode");
      expect(created.key.startsWith(created.view.prefix)).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("verifies a presented key and rejects unknown ones", () => {
    const { service, cleanup } = createService();
    try {
      const created = service.create("KiloCode");
      expect(service.verify(created.key)?.name).toBe("KiloCode");
      expect(service.verify("ck-deadbeef")).toBeUndefined();
      expect(service.verify("")).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it("never stores the plaintext key", () => {
    const dir = mkdtempSync(join(tmpdir(), "cokey-test-"));
    const db = new DatabaseClient(join(dir, "cokey.db"));
    try {
      const repo = new ApiKeysRepo(db);
      const service = new ApiKeyService(repo);
      const created = service.create("CI");

      const row = repo.get(created.view.id);
      expect(row).toBeDefined();
      expect(JSON.stringify(row)).not.toContain(created.key);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("revokes a key so it no longer verifies", () => {
    const { service, cleanup } = createService();
    try {
      const created = service.create("Temporary");
      service.revoke(created.view.id);
      expect(service.verify(created.key)).toBeUndefined();
      expect(service.list()).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it("issues a different key each time", () => {
    const { service, cleanup } = createService();
    try {
      const first = service.create("A");
      const second = service.create("B");
      expect(first.key).not.toBe(second.key);
      expect(service.list()).toHaveLength(2);
    } finally {
      cleanup();
    }
  });
});