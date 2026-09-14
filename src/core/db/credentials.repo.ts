import type { CredentialRow, DatabaseClient } from "./database.js";

export interface InsertCredentialInput {
  id: string;
  providerId: string;
  accountId?: string;
  secretEncrypted: string;
  proxyUrl?: string;
  /** 1 when the pool picked this proxy, 0 when the user set it. */
  proxyAuto?: number;
  description: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  usage: string;
}

/** Partial update. Absent keys are left untouched; `null` clears a column. */
export interface CredentialPatch {
  providerId?: string;
  accountId?: string | null;
  secretEncrypted?: string;
  proxyUrl?: string | null;
  proxyAuto?: number;
  description?: string;
  status?: string;
  updatedAt?: number;
  lastVerifiedAt?: number | null;
  usage?: string;
  quota?: string | null;
  cooldownUntil?: number | null;
  consecutiveFailures?: number;
}

const COLUMNS: Record<keyof CredentialPatch, string> = {
  providerId: "provider_id",
  accountId: "account_id",
  secretEncrypted: "secret_encrypted",
  proxyUrl: "proxy_url",
  proxyAuto: "proxy_auto",
  description: "description",
  status: "status",
  updatedAt: "updated_at",
  lastVerifiedAt: "last_verified_at",
  usage: "usage",
  quota: "quota",
  cooldownUntil: "cooldown_until",
  consecutiveFailures: "consecutive_failures",
};

export class CredentialsRepo {
  constructor(private readonly db: DatabaseClient) {}

  insert(input: InsertCredentialInput): void {
    this.db
      .prepareCached(
        `INSERT INTO credentials
           (id, provider_id, account_id, secret_encrypted, proxy_url, proxy_auto, description, status,
            created_at, updated_at, usage, consecutive_failures)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        input.id,
        input.providerId,
        input.accountId ?? null,
        input.secretEncrypted,
        input.proxyUrl ?? null,
        input.proxyAuto ?? 0,
        input.description,
        input.status,
        input.createdAt,
        input.updatedAt,
        input.usage,
      );
  }

  get(id: string): CredentialRow | undefined {
    return this.db.prepareCached(`SELECT * FROM credentials WHERE id = ?`).get(id) as
      CredentialRow | undefined;
  }

  list(providerId?: string): CredentialRow[] {
    if (providerId) {
      return this.db
        .prepareCached(`SELECT * FROM credentials WHERE provider_id = ? ORDER BY created_at ASC`)
        .all(providerId) as CredentialRow[];
    }
    return this.db
      .prepareCached(`SELECT * FROM credentials ORDER BY created_at ASC`)
      .all() as CredentialRow[];
  }

  /** Fetch a set of ids in one query; used by the router on every request. */
  listByIds(ids: string[]): CredentialRow[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(", ");
    return this.db
      .prepareCached(`SELECT * FROM credentials WHERE id IN (${placeholders})`)
      .all(...ids) as CredentialRow[];
  }

  update(id: string, patch: CredentialPatch): void {
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const [key, column] of Object.entries(COLUMNS) as Array<[keyof CredentialPatch, string]>) {
      if (key in patch) {
        sets.push(`${column} = ?`);
        const value = patch[key];
        values.push(value === undefined ? null : value);
      }
    }
    if (sets.length === 0) return;
    values.push(id);
    this.db.prepareCached(`UPDATE credentials SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }

  delete(id: string): void {
    this.db.prepareCached(`DELETE FROM credentials WHERE id = ?`).run(id);
  }

  deleteByProvider(providerId: string): number {
    return this.db.prepareCached(`DELETE FROM credentials WHERE provider_id = ?`).run(providerId)
      .changes;
  }

  countsByProvider(): Array<{ provider_id: string; total: number; healthy: number }> {
    return this.db
      .prepareCached(
        `SELECT provider_id,
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) AS healthy
         FROM credentials GROUP BY provider_id`,
      )
      .all() as Array<{ provider_id: string; total: number; healthy: number }>;
  }

  count(): number {
    const row = this.db.prepareCached(`SELECT COUNT(*) AS n FROM credentials`).get() as { n: number };
    return row.n;
  }
}
