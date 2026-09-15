import { emptyRate, type CredentialRate } from "../types.js";

const WINDOW_MS = 5 * 60_000;

const BUCKET_MS = 5_000;
const BUCKETS = 12;

interface RateEntry {
  stamps: number[];
  lastRateLimitedAt?: number;
  lastRequestAt?: number;
}

export class RateTracker {
  private readonly entries = new Map<string, RateEntry>();

  record(credentialId: string, at = Date.now()): void {
    const entry = this.entryFor(credentialId);
    entry.stamps.push(at);

    entry.lastRequestAt = Math.max(entry.lastRequestAt ?? 0, at);
    this.prune(entry, at);
  }

  recordRateLimited(credentialId: string, at = Date.now()): void {
    const entry = this.entryFor(credentialId);
    entry.lastRateLimitedAt = at;
  }

  snapshot(credentialId: string, now = Date.now()): CredentialRate {
    const entry = this.entries.get(credentialId);
    if (!entry) return emptyRate();

    this.prune(entry, now);

    const oneMinuteAgo = now - 60_000;
    const requestsPerMinute = entry.stamps.filter((at) => at > oneMinuteAgo).length;

    const sparkline = new Array<number>(BUCKETS).fill(0);
    for (const at of entry.stamps) {
      const age = now - at;
      if (age < 0 || age >= BUCKETS * BUCKET_MS) continue;

      const index = BUCKETS - 1 - Math.floor(age / BUCKET_MS);
      if (index >= 0 && index < BUCKETS) sparkline[index] += 1;
    }

    return {
      requestsPerMinute,
      requestsLast5Minutes: entry.stamps.length,
      recentlyRateLimited:
        entry.lastRateLimitedAt !== undefined && now - entry.lastRateLimitedAt <= WINDOW_MS,
      sparkline,
      lastRequestAt: entry.lastRequestAt,
    };
  }

  forget(credentialId: string): void {
    this.entries.delete(credentialId);
  }

  reset(credentialId?: string): void {
    if (credentialId) this.entries.delete(credentialId);
    else this.entries.clear();
  }

  private entryFor(credentialId: string): RateEntry {
    let entry = this.entries.get(credentialId);
    if (!entry) {
      entry = { stamps: [] };
      this.entries.set(credentialId, entry);
    }
    return entry;
  }

  private prune(entry: RateEntry, now: number): void {
    if (entry.stamps.length === 0) return;
    const cutoff = now - WINDOW_MS;

    const kept = entry.stamps.filter((at) => at > cutoff);
    if (kept.length !== entry.stamps.length) entry.stamps = kept;
  }
}
