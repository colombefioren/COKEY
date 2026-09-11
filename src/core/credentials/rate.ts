import { emptyRate, type CredentialRate } from "../types.js";

/** How long raw request timestamps are retained. */
const WINDOW_MS = 5 * 60_000;
/** Sparkline resolution: 12 buckets × 5s = the trailing minute. */
const BUCKET_MS = 5_000;
const BUCKETS = 12;

interface RateEntry {
  /** Request timestamps, newest last, pruned to {@link WINDOW_MS}. */
  stamps: number[];
  lastRateLimitedAt?: number;
  lastRequestAt?: number;
}

/**
 * In-memory, per-credential throughput.
 *
 * Declared provider quotas are frequently absent or a lie, and two keys from
 * the same provider look identical in every other view. This tracker is what
 * makes each key distinguishable: it measures what COKEY actually sent through
 * it, so a user can see which of their three Groq keys is carrying the load and
 * which one is idle.
 *
 * Deliberately bounded and never persisted: it is a live gauge, not billing.
 */
export class RateTracker {
  private readonly entries = new Map<string, RateEntry>();

  /** Record one outbound attempt through a credential. */
  record(credentialId: string, at = Date.now()): void {
    const entry = this.entryFor(credentialId);
    entry.stamps.push(at);
    entry.lastRequestAt = at;
    this.prune(entry, at);
  }

  /** Note that a provider rejected this credential for rate/quota reasons. */
  recordRateLimited(credentialId: string, at = Date.now()): void {
    const entry = this.entryFor(credentialId);
    entry.lastRateLimitedAt = at;
  }

  /** Current throughput for one credential. */
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
      // Oldest bucket first, so the array reads left-to-right in time.
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

  /** Drop tracking for a credential that no longer exists. */
  forget(credentialId: string): void {
    this.entries.delete(credentialId);
  }

  /** Clear everything, optionally for one credential. Mostly for tests. */
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
    const cutoff = now - WINDOW_MS;
    // Timestamps are appended in order, so trimming the head is enough.
    let drop = 0;
    while (drop < entry.stamps.length && entry.stamps[drop]! <= cutoff) drop += 1;
    if (drop > 0) entry.stamps.splice(0, drop);
  }
}
