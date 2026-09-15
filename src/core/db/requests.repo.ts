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

const PRUNE_EVERY = 50;

const USAGE_DAILY_RETENTION_DAYS = 90;

export class RequestsRepo {
  private insertsSincePrune = 0;

  constructor(
    private readonly db: DatabaseClient,
    private readonly maxRows = 500,
  ) {}

  insert(input: InsertRequestLogInput): void {
    const inputTokens = input.inputTokens ?? 0;
    const outputTokens = input.outputTokens ?? 0;

    this.db
      .prepareCached(
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

  private rollup(input: InsertRequestLogInput, inputTokens: number, outputTokens: number): void {
    const day = new Date(input.at).toISOString().slice(0, 10);
    const success = input.outcome === "success" ? 1 : 0;
    const failure = input.outcome === "success" ? 0 : 1;
    this.db
      .prepareCached(
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

  rollupSince(sinceDay: string): UsageRollupRow[] {
    return this.db
      .prepareCached(`SELECT * FROM usage_daily WHERE day >= ? ORDER BY day DESC`)
      .all(sinceDay) as UsageRollupRow[];
  }

  list(limit = 100): RequestLogRow[] {
    return this.db
      .prepareCached(`SELECT * FROM request_log ORDER BY at DESC LIMIT ?`)
      .all(Math.max(1, Math.min(limit, this.maxRows))) as RequestLogRow[];
  }

  count(): number {
    const row = this.db.prepareCached(`SELECT COUNT(*) AS n FROM request_log`).get() as {
      n: number;
    };
    return row.n;
  }

  clear(): void {
    this.db.prepareCached(`DELETE FROM request_log`).run();
  }

  prune(): void {
    this.db
      .prepareCached(
        `DELETE FROM request_log WHERE id NOT IN (
           SELECT id FROM request_log ORDER BY at DESC LIMIT ?
         )`,
      )
      .run(this.maxRows);
  }

  pruneUsageDaily(retainDays = USAGE_DAILY_RETENTION_DAYS): void {
    const cutoff = new Date(Date.now() - retainDays * 86_400_000).toISOString().slice(0, 10);
    this.db.prepareCached(`DELETE FROM usage_daily WHERE day < ?`).run(cutoff);
  }
}
