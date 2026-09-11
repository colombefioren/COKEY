import type { Credential } from "../types.js";

const RETRY_AFTER_SECONDS_RE = /^\s*(\d+)\s*$/;
const HTTP_DATE_RE = /^\s*[A-Za-z]{3}, \d{1,2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT\s*$/;

/**
 * Parse a `Retry-After` header.
 *
 * Supports both legal forms: delta-seconds and an HTTP-date. Returns
 * milliseconds from now, or `undefined` when the value is absent/unparseable.
 */
export function parseRetryAfter(value: string | undefined | null): number | undefined {
  if (!value) return undefined;
  const trimmed = String(value).trim();

  if (RETRY_AFTER_SECONDS_RE.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  if (HTTP_DATE_RE.test(trimmed)) {
    const when = Date.parse(trimmed);
    if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
  }
  return undefined;
}

export interface CooldownPolicy {
  baseMs: number;
  maxMs: number;
  /** Fraction of the computed delay applied as +/- jitter, e.g. 0.15. */
  jitterRatio: number;
}

export const DEFAULT_COOLDOWN_POLICY: CooldownPolicy = {
  baseMs: 30_000,
  maxMs: 300_000,
  jitterRatio: 0.15,
};

/**
 * Decides how long a credential should sit out after a rate limit.
 *
 * A provider-supplied `Retry-After` always wins. Otherwise the delay grows
 * 30s → 60s → 120s → 300s, capped, with jitter to avoid synchronised retries.
 */
export class CooldownManager {
  constructor(private policy: CooldownPolicy = DEFAULT_COOLDOWN_POLICY) {}

  setPolicy(policy: CooldownPolicy): void {
    this.policy = policy;
  }

  getPolicy(): CooldownPolicy {
    return { ...this.policy };
  }

  isInCooldown(credential: Credential, now = Date.now()): boolean {
    if (credential.status !== "cooldown") return false;
    if (!credential.cooldownUntil) return false;
    return credential.cooldownUntil > now;
  }

  /**
   * Compute the cooldown duration for a credential.
   *
   * Exposed for tests and for the CLI's `--explain` output.
   */
  computeCooldownMs(credential: Credential, retryAfterHeader?: string): number {
    const fromHeader = parseRetryAfter(retryAfterHeader);
    if (fromHeader !== undefined) {
      // A provider may ask for a very long window; cap it so a credential is
      // probed again in the same session.
      return Math.min(fromHeader, this.policy.maxMs * 4);
    }

    const factor = Math.max(1, credential.consecutiveFailures + 1);
    const raw = this.policy.baseMs * Math.pow(2, factor - 1);
    const capped = Math.min(this.policy.maxMs, raw);
    const jitter = capped * this.policy.jitterRatio * (Math.random() * 2 - 1);
    return Math.max(1000, Math.round(capped + jitter));
  }

  /** Absolute timestamp the credential becomes usable again. */
  cooldownUntil(credential: Credential, retryAfterHeader?: string): number {
    return Date.now() + this.computeCooldownMs(credential, retryAfterHeader);
  }
}
