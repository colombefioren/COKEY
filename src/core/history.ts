import { randomUUID } from "node:crypto";
import type { RequestsRepo, UsageRollupRow } from "./db/requests.repo.js";
import type { RequestLogRow } from "./db/database.js";
import type { ErrorClassification, RequestLogEntry } from "./types.js";

export interface RecordRequestInput {
  chainAlias: string;
  entryId: string;
  providerId: string;
  model: string;
  credentialId: string;
  credentialDescription: string;
  latencyMs: number;
  outcome: "success" | "error";
  classification: ErrorClassification | "skipped" | "aborted";
  fallback: boolean;
  fallbackReason?: string;
  attempts: number;
  stream: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

export interface HistoryStats {
  total: number;
  success: number;
  failure: number;
  fallbackCount: number;
  averageLatencyMs: number;
  byClassification: Record<string, number>;
}

/**
 * Bounded, local-only request history.
 *
 * This backs the observability view (`16:42:31  qwen3.8-27b  Main account  429 →
 * Backup  200  1.4s`). It is capped so it can never grow without limit, and it
 * is never transmitted anywhere.
 */
export class RequestHistory {
  constructor(
    private readonly repo: RequestsRepo,
    private readonly limit = 100,
  ) {}

  record(input: RecordRequestInput): RequestLogEntry {
    const entry: RequestLogEntry = {
      id: randomUUID(),
      at: Date.now(),
      chainAlias: input.chainAlias,
      entryId: input.entryId,
      providerId: input.providerId,
      model: input.model,
      credentialId: input.credentialId,
      credentialDescription: input.credentialDescription,
      latencyMs: input.latencyMs,
      outcome: input.outcome,
      classification: input.classification as ErrorClassification,
      fallback: input.fallback,
      fallbackReason: input.fallbackReason,
      attempts: input.attempts,
      stream: input.stream,
      inputTokens: input.inputTokens ?? 0,
      outputTokens: input.outputTokens ?? 0,
    };

    this.repo.insert({ ...entry });
    return entry;
  }

  list(limit = this.limit): RequestLogEntry[] {
    return this.repo.list(limit).map(rowToEntry);
  }

  stats(): HistoryStats {
    const rows = this.repo.list(this.limit);
    const stats: HistoryStats = {
      total: rows.length,
      success: 0,
      failure: 0,
      fallbackCount: 0,
      averageLatencyMs: 0,
      byClassification: {},
    };

    let latencySum = 0;
    for (const row of rows) {
      if (row.outcome === "success") stats.success += 1;
      else stats.failure += 1;
      if (row.fallback === 1) stats.fallbackCount += 1;
      latencySum += row.latency_ms;
      const key = row.classification || "unknown";
      stats.byClassification[key] = (stats.byClassification[key] ?? 0) + 1;
    }

    stats.averageLatencyMs = rows.length === 0 ? 0 : Math.round(latencySum / rows.length);
    return stats;
  }

  count(): number {
    return this.repo.count();
  }

  /** Per-day/per-provider/per-key/per-model rollup since `sinceDay` (YYYY-MM-DD). */
  rollup(sinceDay: string): UsageRollupRow[] {
    return this.repo.rollupSince(sinceDay);
  }

  clear(): void {
    this.repo.clear();
  }
}

function rowToEntry(row: RequestLogRow): RequestLogEntry {
  return {
    id: row.id,
    at: row.at,
    chainAlias: row.chain_alias,
    entryId: row.entry_id,
    providerId: row.provider_id,
    model: row.model,
    credentialId: row.credential_id,
    credentialDescription: row.credential_description,
    latencyMs: row.latency_ms,
    outcome: row.outcome === "success" ? "success" : "error",
    classification: row.classification as ErrorClassification,
    fallback: row.fallback === 1,
    fallbackReason: row.fallback_reason ?? undefined,
    attempts: row.attempts,
    stream: row.stream === 1,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
  };
}
