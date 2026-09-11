import type { DatabaseClient, RequestLogRow } from "./database.js";

export interface InsertRequestLogInput {
  id: string;
  at: number;
  chainAlias: string;
  entryId: string;
  providerId: string;
  model: string;
  credentialId: string;
  credentialDescription: string;
  latencyMs: number;
  outcome: string;
  classification: string;
  fallback: boolean;
  fallbackReason?: string;
  attempts: number;
  stream: boolean;
}

/** Local, bounded request history powering the observability view. */
export class RequestsRepo {
  constructor(
    private readonly db: DatabaseClient,
    private readonly maxRows = 500,
  ) {}

  insert(input: InsertRequestLogInput): void {
    this.db.db
      .prepare(
        `INSERT INTO request_log
           (id, at, chain_alias, entry_id, provider_id, model, credential_id,
            credential_description, latency_ms, outcome, classification, fallback,
            fallback_reason, attempts, stream)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.at,
        input.chainAlias,
        input.entryId,
        input.providerId,
        input.model,
        input.credentialId,
        input.credentialDescription,
        input.latencyMs,
        input.outcome,
        input.classification,
        input.fallback ? 1 : 0,
        input.fallbackReason ?? null,
        input.attempts,
        input.stream ? 1 : 0,
      );
    this.prune();
  }

  list(limit = 100): RequestLogRow[] {
    return this.db.db
      .prepare(`SELECT * FROM request_log ORDER BY at DESC LIMIT ?`)
      .all(Math.max(1, Math.min(limit, this.maxRows))) as RequestLogRow[];
  }

  count(): number {
    const row = this.db.db.prepare(`SELECT COUNT(*) AS n FROM request_log`).get() as { n: number };
    return row.n;
  }

  clear(): void {
    this.db.db.prepare(`DELETE FROM request_log`).run();
  }

  /** Keep only the newest `maxRows` records. */
  prune(): void {
    this.db.db
      .prepare(
        `DELETE FROM request_log WHERE id NOT IN (
           SELECT id FROM request_log ORDER BY at DESC LIMIT ?
         )`,
      )
      .run(this.maxRows);
  }
}
