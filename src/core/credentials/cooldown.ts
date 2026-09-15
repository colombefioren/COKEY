import type { Credential } from "../types.js";

const RETRY_AFTER_SECONDS_RE = /^\s*(\d+)\s*$/;
const HTTP_DATE_RE = /^\s*[A-Za-z]{3}, \d{1,2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT\s*$/;

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

  jitterRatio: number;
}

export const DEFAULT_COOLDOWN_POLICY: CooldownPolicy = {
  baseMs: 30_000,
  maxMs: 300_000,
  jitterRatio: 0.15,
};

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

  computeCooldownMs(credential: Credential, retryAfterHeader?: string): number {
    const fromHeader = parseRetryAfter(retryAfterHeader);
    if (fromHeader !== undefined) {
      return Math.min(fromHeader, this.policy.maxMs * 4);
    }

    const factor = Math.max(1, credential.consecutiveFailures + 1);
    const raw = this.policy.baseMs * Math.pow(2, factor - 1);
    const capped = Math.min(this.policy.maxMs, raw);
    const jitter = capped * this.policy.jitterRatio * (Math.random() * 2 - 1);
    return Math.max(1000, Math.round(capped + jitter));
  }

  cooldownUntil(credential: Credential, retryAfterHeader?: string): number {
    return Date.now() + this.computeCooldownMs(credential, retryAfterHeader);
  }
}
