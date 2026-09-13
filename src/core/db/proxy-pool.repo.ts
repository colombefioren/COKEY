import type { DatabaseClient } from "./database.js";

export interface ProxyPoolRow {
  id: string;
  url: string;
  label: string;
  enabled: number;
  created_at: number;
}

export interface InsertProxyInput {
  id: string;
  url: string;
  label: string;
  enabled: boolean;
  createdAt: number;
}

/** Storage for the automatic egress pool. */
export class ProxyPoolRepo {
  constructor(private readonly db: DatabaseClient) {}

  insert(input: InsertProxyInput): void {
    this.db.db
      .prepare(
        `INSERT INTO proxy_pool (id, url, label, enabled, created_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(input.id, input.url, input.label, input.enabled ? 1 : 0, input.createdAt);
  }

  get(id: string): ProxyPoolRow | undefined {
    return this.db.db.prepare(`SELECT * FROM proxy_pool WHERE id = ?`).get(id) as
      ProxyPoolRow | undefined;
  }

  findByUrl(url: string): ProxyPoolRow | undefined {
    return this.db.db.prepare(`SELECT * FROM proxy_pool WHERE url = ?`).get(url) as
      ProxyPoolRow | undefined;
  }

  list(): ProxyPoolRow[] {
    return this.db.db
      .prepare(`SELECT * FROM proxy_pool ORDER BY created_at ASC`)
      .all() as ProxyPoolRow[];
  }

  listEnabled(): ProxyPoolRow[] {
    return this.db.db
      .prepare(`SELECT * FROM proxy_pool WHERE enabled = 1 ORDER BY created_at ASC`)
      .all() as ProxyPoolRow[];
  }

  setEnabled(id: string, enabled: boolean): void {
    this.db.db.prepare(`UPDATE proxy_pool SET enabled = ? WHERE id = ?`).run(enabled ? 1 : 0, id);
  }

  delete(id: string): void {
    this.db.db.prepare(`DELETE FROM proxy_pool WHERE id = ?`).run(id);
  }

  count(): number {
    const row = this.db.db.prepare(`SELECT COUNT(*) AS n FROM proxy_pool`).get() as {
      n: number;
    };
    return row.n;
  }
}
