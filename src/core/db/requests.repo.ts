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
  inputTokens?: number;
  outputTokens?: number;
}

export interface UsageRollupRow {
  day: string;
  provider_id: string;
  credential_id: string;
  model: string;
  requests: number;
  success: number;
  failure: number;
  input_tokens: number;
  output_tokens: number;
  latency_ms_sum: number;
}

/** How often `insert()` prunes, in number of inserts. Pruning runs a
 * `DELETE ... ORDER BY ... LIMIT` scan that only matters once the table is
 * already near its cap, so paying for it on every single proxied request
 * would tax the hot path for no benefit between prunes. */
const PRUNE_EVERY = 50;

/** How many days of `usage_daily` rollups to retain. The dashboard's own
 * rollup query never looks back further than 29 days, so this is already
 * generous headroom rather than a tight cutoff. */
const USAGE_DAILY_RETENTION_DAYS = 90;

/** Local, bounded request history powering the observability view. */
export class RequestsRepo {
  private insertsSincePrune = 0;

  constructor(
    private readonly db: DatabaseClient,
    private readonly maxRows = 500,
  ) {}

  insert(input: InsertRequestLogInput): void {
    const inputTokens = input.inputTokens ?? 0;
    const outputTokens = input.outputTokens ?? 0;

    this.db.db
      .prepare(
        `INSERT INTO request_log
           (id, at, chain_alias, entry_id, provider_id, model, credential_id,
            credential_description, latency_ms, outcome, classification, fallback,
            fallback_reason, attempts, stream, input_tokens, output_tokens)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        inputTokens,
        outputTokens,
      );

    this.rollup(input, inputTokens, outputTokens);

    this.insertsSincePrune += 1;
    if (this.insertsSincePrune >= PRUNE_EVERY) {
      this.insertsSincePrune = 0;
      this.prune();
      this.pruneUsageDaily();
    }
  }

  /** Fold one request into the per-day/per-key/per-model rollup. */
  private rollup(input: InsertRequestLogInput, inputTokens: number, outputTokens: number): void {
    const day = new Date(input.at).toISOString().slice(0, 10);
    const success = input.outcome === "success" ? 1 : 0;
    const failure = input.outcome === "success" ? 0 : 1;
    this.db.db
      .prepare(
        `INSERT INTO usage_daily
           (day, provider_id, credential_id, model, requests, success, failure,
            input_tokens, output_tokens, latency_ms_sum)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
         ON CONFLICT(day, provider_id, credential_id, model) DO UPDATE SET
           requests = requests + 1,
           success = success + excluded.success,
           failure = failure + excluded.failure,
           input_tokens = input_tokens + excluded.input_tokens,
           output_tokens = output_tokens + excluded.output_tokens,
           latency_ms_sum = latency_ms_sum + excluded.latency_ms_sum`,
      )
      .run(
        day,
        input.providerId,
        input.credentialId,
        input.model,
        success,
        failure,
        inputTokens,
        outputTokens,
        input.latencyMs,
      );
  }

  /** Daily rollup rows in [sinceDay, today], newest first. */
  rollupSince(sinceDay: string): UsageRollupRow[] {
    return this.db.db
      .prepare(`SELECT * FROM usage_daily WHERE day >= ? ORDER BY day DESC`)
      .all(sinceDay) as UsageRollupRow[];
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

  /** Drop rollup rows older than the retention window - unlike `request_log`,
   * this table is only ever appended to via upserts, so it grows forever
   * without this. */
  pruneUsageDaily(retainDays = USAGE_DAILY_RETENTION_DAYS): void {
    const cutoff = new Date(Date.now() - retainDays * 86_400_000).toISOString().slice(0, 10);
    this.db.db.prepare(`DELETE FROM usage_daily WHERE day < ?`).run(cutoff);
  }
}
