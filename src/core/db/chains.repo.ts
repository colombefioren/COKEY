import type { ChainEntryRow, ChainRow, DatabaseClient } from "./database.js";

export interface InsertChainInput {
  id: string;
  alias: string;
  description?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChainPatch {
  alias?: string;
  description?: string | null;
  enabled?: number;
  updatedAt?: number;
}

export interface InsertEntryInput {
  id: string;
  chainId: string;
  providerId: string;
  model: string;
  label?: string;
  baseUrl: string;
  credentialIds: string;
  enabled: boolean;
  priority: number;
  routingStrategy: string;
  createdAt: number;
  updatedAt: number;
}

export interface EntryPatch {
  providerId?: string;
  model?: string;
  label?: string | null;
  baseUrl?: string;
  credentialIds?: string;
  enabled?: number;
  priority?: number;
  routingStrategy?: string;
  updatedAt?: number;
}

const CHAIN_COLUMNS: Record<keyof ChainPatch, string> = {
  alias: "alias",
  description: "description",
  enabled: "enabled",
  updatedAt: "updated_at",
};

const ENTRY_COLUMNS: Record<keyof EntryPatch, string> = {
  providerId: "provider_id",
  model: "model",
  label: "label",
  baseUrl: "base_url",
  credentialIds: "credential_ids",
  enabled: "enabled",
  priority: "priority",
  routingStrategy: "routing_strategy",
  updatedAt: "updated_at",
};

export class ChainsRepo {
  constructor(private readonly db: DatabaseClient) {}

  // ---- chains -------------------------------------------------------------

  insertChain(input: InsertChainInput): void {
    this.db
      .prepareCached(
        `INSERT INTO chains (id, alias, description, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.alias,
        input.description ?? null,
        input.enabled ? 1 : 0,
        input.createdAt,
        input.updatedAt,
      );
  }

  getChain(id: string): ChainRow | undefined {
    return this.db.prepareCached(`SELECT * FROM chains WHERE id = ?`).get(id) as ChainRow | undefined;
  }

  getChainByAlias(alias: string): ChainRow | undefined {
    return this.db.prepareCached(`SELECT * FROM chains WHERE alias = ?`).get(alias) as
      ChainRow | undefined;
  }

  listChains(): ChainRow[] {
    return this.db.prepareCached(`SELECT * FROM chains ORDER BY created_at ASC`).all() as ChainRow[];
  }

  updateChain(id: string, patch: ChainPatch): void {
    this.applyPatch("chains", id, patch, CHAIN_COLUMNS);
  }

  deleteChain(id: string): void {
    this.db.prepareCached(`DELETE FROM chains WHERE id = ?`).run(id);
  }

  // ---- entries ------------------------------------------------------------

  insertEntry(input: InsertEntryInput): void {
    this.db
      .prepareCached(
        `INSERT INTO chain_entries
           (id, chain_id, provider_id, model, label, base_url, credential_ids, enabled,
            priority, routing_strategy, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.chainId,
        input.providerId,
        input.model,
        input.label ?? null,
        input.baseUrl,
        input.credentialIds,
        input.enabled ? 1 : 0,
        input.priority,
        input.routingStrategy,
        input.createdAt,
        input.updatedAt,
      );
  }

  getEntry(id: string): ChainEntryRow | undefined {
    return this.db.prepareCached(`SELECT * FROM chain_entries WHERE id = ?`).get(id) as
      ChainEntryRow | undefined;
  }

  listEntries(chainId: string): ChainEntryRow[] {
    return this.db
      .prepareCached(`SELECT * FROM chain_entries WHERE chain_id = ? ORDER BY priority ASC`)
      .all(chainId) as ChainEntryRow[];
  }

  listEntriesByProvider(providerId: string): ChainEntryRow[] {
    return this.db
      .prepareCached(`SELECT * FROM chain_entries WHERE provider_id = ?`)
      .all(providerId) as ChainEntryRow[];
  }

  updateEntry(id: string, patch: EntryPatch): void {
    this.applyPatch("chain_entries", id, patch, ENTRY_COLUMNS);
  }

  deleteEntry(id: string): void {
    this.db.prepareCached(`DELETE FROM chain_entries WHERE id = ?`).run(id);
  }

  deleteEntriesForChain(chainId: string): void {
    this.db.prepareCached(`DELETE FROM chain_entries WHERE chain_id = ?`).run(chainId);
  }

  /** Apply an explicit priority ordering in one transaction. */
  reorder(chainId: string, orderedEntryIds: string[]): void {
    const statement = this.db.prepareCached(
      `UPDATE chain_entries SET priority = ?, updated_at = ? WHERE id = ? AND chain_id = ?`,
    );
    const now = Date.now();
    this.db.transaction(() => {
      orderedEntryIds.forEach((id, index) => {
        statement.run(index + 1, now, id, chainId);
      });
    });
  }

  maxPriority(chainId: string): number {
    const row = this.db
      .prepareCached(`SELECT MAX(priority) AS p FROM chain_entries WHERE chain_id = ?`)
      .get(chainId) as { p: number | null };
    return row.p ?? 0;
  }

  private applyPatch<T extends object>(
    table: string,
    id: string,
    patch: T,
    columns: Record<string, string>,
  ): void {
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(columns)) {
      if (key in patch) {
        sets.push(`${column} = ?`);
        const value = (patch as Record<string, unknown>)[key];
        values.push(value === undefined ? null : value);
      }
    }
    if (sets.length === 0) return;
    values.push(id);
    this.db.prepareCached(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }
}
