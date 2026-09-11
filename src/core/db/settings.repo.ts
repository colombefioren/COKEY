import type { DatabaseClient } from "./database.js";

/** Key/value store backing the persisted half of Settings. */
export class SettingsRepo {
  constructor(private readonly db: DatabaseClient) {}

  get(key: string): string | undefined {
    const row = this.db.db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  getJson<T>(key: string): T | undefined {
    const raw = this.get(key);
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  set(key: string, value: string): void {
    this.db.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value);
  }

  setJson(key: string, value: unknown): void {
    this.set(key, JSON.stringify(value));
  }

  delete(key: string): void {
    this.db.db.prepare(`DELETE FROM settings WHERE key = ?`).run(key);
  }

  all(): Record<string, string> {
    const rows = this.db.db.prepare(`SELECT key, value FROM settings ORDER BY key ASC`).all() as Array<{
      key: string;
      value: string;
    }>;
    const out: Record<string, string> = {};
    for (const row of rows) out[row.key] = row.value;
    return out;
  }
}
