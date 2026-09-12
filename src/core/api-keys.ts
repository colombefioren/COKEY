import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { ApiKeyRow } from "./db/database.js";
import type { ApiKeysRepo } from "./db/api-keys.repo.js";

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  createdAt: number;
  lastUsedAt?: number;
  enabled: boolean;
}

export interface CreatedApiKey {
  key: string;
  view: ApiKeyView;
}

export class ApiKeyNotFoundError extends Error {
  constructor(id: string) {
    super(`API key not found: ${id}`);
    this.name = "ApiKeyNotFoundError";
  }
}

const TOUCH_INTERVAL_MS = 60_000;

/**
 * Named management API keys.
 *
 * The plaintext secret is returned exactly once, at creation. Only a SHA-256
 * hash is persisted, so a database read can never reveal a usable key.
 */
export class ApiKeyService {
  constructor(private readonly repo: ApiKeysRepo) {}

  create(name: string): CreatedApiKey {
    const key = `ck-${randomBytes(24).toString("hex")}`;
    const id = randomUUID();
    const createdAt = Date.now();
    const prefix = key.slice(0, 10);
    this.repo.insert({ id, name, prefix, keyHash: hashKey(key), createdAt });
    return { key, view: { id, name, prefix, createdAt, enabled: true } };
  }

  list(): ApiKeyView[] {
    return this.repo.list().map(toView);
  }

  verify(presented: string): ApiKeyView | undefined {
    if (!presented) return undefined;
    const row = this.repo.getByHash(hashKey(presented));
    if (!row || row.enabled !== 1) return undefined;
    const now = Date.now();
    if (row.last_used_at === null || now - row.last_used_at > TOUCH_INTERVAL_MS) {
      this.repo.touch(row.id, now);
    }
    return toView(row);
  }

  revoke(id: string): void {
    if (!this.repo.get(id)) throw new ApiKeyNotFoundError(id);
    this.repo.delete(id);
  }

  count(): number {
    return this.repo.count();
  }
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function toView(row: ApiKeyRow): ApiKeyView {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? undefined,
    enabled: row.enabled === 1,
  };
}
