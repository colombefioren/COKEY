import type { DatabaseClient, ProviderModelRow } from "./database.js";

/** The observed inventory of one provider, as stored. */
export interface ProviderModelRecord {
  providerId: string;
  model: string;
  /** True when the shipped catalog also lists this model. */
  curated: boolean;
  /** True when the provider returned it on the most recent check. */
  available: boolean;
  firstSeen: number;
  lastSeen: number;
  lastChecked: number;
}

/**
 * Storage for what each provider actually serves.
 *
 * The catalog in `src/catalog` is a curated default written by hand. This table
 * is the observed truth written by asking the provider. The two are joined at
 * read time: the catalog supplies context (window size, best use), the inventory
 * supplies whether the model is still there.
 */
export class ProviderModelsRepo {
  constructor(private readonly db: DatabaseClient) {}

  /**
   * Replace one provider's inventory with `records`.
   *
   * The reconciler has already decided the complete final set, including any
   * recently-missing models that are being remembered, so a wholesale replace is
   * both correct and far simpler than a diff. It runs in a single transaction so
   * a crash mid-write cannot leave a provider with a half-populated inventory
   * that would read as "everything was removed".
   */
  replace(providerId: string, records: ProviderModelRecord[]): void {
    const deleteStmt = this.db.prepareCached(`DELETE FROM provider_models WHERE provider_id = ?`);
    const insertStmt = this.db.prepareCached(
      `INSERT INTO provider_models
         (provider_id, model, curated, available, first_seen, last_seen, last_checked)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    this.db.transaction(() => {
      deleteStmt.run(providerId);
      for (const record of records) {
        insertStmt.run(
          record.providerId,
          record.model,
          record.curated ? 1 : 0,
          record.available ? 1 : 0,
          record.firstSeen,
          record.lastSeen,
          record.lastChecked,
        );
      }
    });
  }

  listByProvider(providerId: string): ProviderModelRecord[] {
    const rows = this.db
      .prepareCached(`SELECT * FROM provider_models WHERE provider_id = ? ORDER BY model ASC`)
      .all(providerId) as ProviderModelRow[];
    return rows.map(toRecord);
  }

  listAll(): ProviderModelRecord[] {
    const rows = this.db
      .prepareCached(`SELECT * FROM provider_models ORDER BY provider_id ASC, model ASC`)
      .all() as ProviderModelRow[];
    return rows.map(toRecord);
  }

  /** The moment this provider's inventory was last written. */
  lastCheckedAt(providerId: string): number | undefined {
    const row = this.db
      .prepareCached(`SELECT MAX(last_checked) AS at FROM provider_models WHERE provider_id = ?`)
      .get(providerId) as { at: number | null };
    return row.at ?? undefined;
  }

  deleteByProvider(providerId: string): number {
    return this.db.prepareCached(`DELETE FROM provider_models WHERE provider_id = ?`).run(providerId)
      .changes;
  }

  /** Total and available model counts per provider, for list views. */
  countsByProvider(): Map<string, { total: number; available: number }> {
    const rows = this.db
      .prepareCached(
        `SELECT provider_id,
                COUNT(*) AS total,
                SUM(CASE WHEN available = 1 THEN 1 ELSE 0 END) AS available
         FROM provider_models GROUP BY provider_id`,
      )
      .all() as Array<{ provider_id: string; total: number; available: number | null }>;

    const out = new Map<string, { total: number; available: number }>();
    for (const row of rows) {
      out.set(row.provider_id, { total: row.total, available: row.available ?? 0 });
    }
    return out;
  }
}

function toRecord(row: ProviderModelRow): ProviderModelRecord {
  return {
    providerId: row.provider_id,
    model: row.model,
    curated: row.curated === 1,
    available: row.available === 1,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    lastChecked: row.last_checked,
  };
}
