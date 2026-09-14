import type { ApiKeyRow, DatabaseClient } from "./database.js";

export interface InsertApiKeyInput {
  id: string;
  name: string;
  prefix: string;
  keyHash: string;
  createdAt: number;
}

/** Storage for named management API keys. Only the hash is ever persisted. */
export class ApiKeysRepo {
  constructor(private readonly db: DatabaseClient) {}

  insert(input: InsertApiKeyInput): void {
    this.db
      .prepareCached(
        `INSERT INTO api_keys (id, name, prefix, key_hash, created_at, last_used_at, enabled)
         VALUES (?, ?, ?, ?, ?, NULL, 1)`,
      )
      .run(input.id, input.name, input.prefix, input.keyHash, input.createdAt);
  }

  list(): ApiKeyRow[] {
    return this.db
      .prepareCached(`SELECT * FROM api_keys ORDER BY created_at DESC`)
      .all() as ApiKeyRow[];
  }

  getByHash(keyHash: string): ApiKeyRow | undefined {
    return this.db.prepareCached(`SELECT * FROM api_keys WHERE key_hash = ?`).get(keyHash) as
      ApiKeyRow | undefined;
  }

  get(id: string): ApiKeyRow | undefined {
    return this.db.prepareCached(`SELECT * FROM api_keys WHERE id = ?`).get(id) as
      ApiKeyRow | undefined;
  }

  touch(id: string, at: number): void {
    this.db.prepareCached(`UPDATE api_keys SET last_used_at = ? WHERE id = ?`).run(at, id);
  }

  delete(id: string): void {
    this.db.prepareCached(`DELETE FROM api_keys WHERE id = ?`).run(id);
  }

  count(): number {
    const row = this.db.prepareCached(`SELECT COUNT(*) AS n FROM api_keys`).get() as { n: number };
    return row.n;
  }
}
