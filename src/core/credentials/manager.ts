import { randomUUID } from "node:crypto";
import type { CredentialRow } from "../db/database.js";
import type { CredentialsRepo } from "../db/credentials.repo.js";
import type { SecretVault } from "../crypto/secrets.js";
import {
  emptyRate,
  emptyUsage,
  type Credential,
  type CredentialProxyInfo,
  type CredentialStatus,
  type ErrorClassification,
  type PublicCredential,
  type QuotaInfo,
  type UsageStats,
} from "../types.js";
import { maskAccountId, maskSecret } from "./masking.js";
import { proxyLabel } from "../providers/proxy.js";
import type { CooldownManager } from "./cooldown.js";
import { RateTracker } from "./rate.js";

export class CredentialNotFoundError extends Error {
  constructor(id: string) {
    super(`Credential not found: ${id}`);
    this.name = "CredentialNotFoundError";
  }
}

export interface CreateCredentialInput {
  providerId: string;
  accountId?: string;
  secret: string;
  description: string;
  /**
   * Optional egress proxy for this key (`socks5://…` or `http://…`).
   *
   * Set a different proxy per credential to rotate exit IPs alongside keys.
   * Without it, several keys from one provider share an IP and therefore share
   * the provider's IP-level limit.
   */
  proxyUrl?: string;
  /** True when the proxy was chosen by the automatic pool. */
  proxyAuto?: boolean;
}

export interface TokenDelta {
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Owns the credential lifecycle: creation, verification state, usage counters
 * and cooldowns.
 *
 * Secrets are decrypted on the way out of the database and are never part of a
 * `PublicCredential`. Every method that can be reached from HTTP returns either
 * a domain object or a masked projection.
 */
export class CredentialManager {
  constructor(
    private readonly repo: CredentialsRepo,
    private readonly vault: SecretVault,
    private readonly cooldown: CooldownManager,
    /** Live per-credential throughput gauge. Defaults to a private tracker. */
    readonly rates: RateTracker = new RateTracker(),
  ) {}

  create(input: CreateCredentialInput): Credential {
    const id = randomUUID();
    const now = Date.now();
    this.repo.insert({
      id,
      providerId: input.providerId,
      accountId: input.accountId,
      secretEncrypted: this.vault.encrypt(input.secret),
      proxyUrl: input.proxyUrl,
      proxyAuto: input.proxyAuto ? 1 : 0,
      description: input.description,
      status: "unverified",
      createdAt: now,
      updatedAt: now,
      usage: JSON.stringify(emptyUsage()),
    });
    return this.getOrThrow(id);
  }

  get(id: string): Credential | undefined {
    const row = this.repo.get(id);
    return row ? this.rowToCredential(row) : undefined;
  }

  getOrThrow(id: string): Credential {
    const credential = this.get(id);
    if (!credential) throw new CredentialNotFoundError(id);
    return credential;
  }

  listAll(): Credential[] {
    return this.repo.list().map((row) => this.rowToCredential(row));
  }

  listByProvider(providerId: string): Credential[] {
    return this.repo.list(providerId).map((row) => this.rowToCredential(row));
  }

  listByIds(ids: string[]): Credential[] {
    // Preserve the caller's ordering, which encodes credential priority.
    const byId = new Map(this.repo.listByIds(ids).map((row) => [row.id, row]));
    const out: Credential[] = [];
    for (const id of ids) {
      const row = byId.get(id);
      if (row) out.push(this.rowToCredential(row));
    }
    return out;
  }

  updateDescription(id: string, description: string): void {
    this.repo.update(id, { description, updatedAt: Date.now() });
  }

  updateAccountId(id: string, accountId: string | null): void {
    this.repo.update(id, { accountId, updatedAt: Date.now() });
  }

  /** Attach, move or clear the egress proxy of a credential. */
  updateProxyUrl(id: string, proxyUrl: string | null): void {
    this.repo.update(id, { proxyUrl, updatedAt: Date.now() });
  }

  /**
   * Record the proxy chosen by the automatic pool.
   *
   * `proxy_auto = 1` is what lets a later pool change move this credential to a
   * different exit while leaving a hand-picked proxy alone.
   */
  setAutoProxyUrl(id: string, proxyUrl: string | null): void {
    this.repo.update(id, {
      proxyUrl,
      proxyAuto: proxyUrl ? 1 : 0,
      updatedAt: Date.now(),
    });
  }

  /**
   * Attach a user-chosen proxy, taking the credential out of the pool.
   *
   * The pool only ever rewrites credentials it owns, so pinning a key here is
   * how a user opts one credential out of automatic egress for good.
   */
  markProxyManual(id: string, proxyUrl: string | null): void {
    this.repo.update(id, { proxyUrl, proxyAuto: 0, updatedAt: Date.now() });
  }

  /** Credentials whose egress is currently owned by the pool. */
  listAutoProxy(): Credential[] {
    return this.listAll().filter((credential) => credential.proxyAuto);
  }

  /** Re-encrypt with a rotated secret. */
  rotateSecret(id: string, secret: string): void {
    this.repo.update(id, {
      secretEncrypted: this.vault.encrypt(secret),
      status: "unverified",
      updatedAt: Date.now(),
    });
  }

  delete(id: string): void {
    this.repo.delete(id);
    this.rates.forget(id);
  }

  setStatus(id: string, status: CredentialStatus): void {
    const patch: Parameters<CredentialsRepo["update"]>[1] = { status, updatedAt: Date.now() };
    if (status !== "cooldown") patch.cooldownUntil = null;
    this.repo.update(id, patch);
  }

  markVerified(id: string): void {
    this.repo.update(id, {
      status: "healthy",
      lastVerifiedAt: Date.now(),
      updatedAt: Date.now(),
      consecutiveFailures: 0,
      cooldownUntil: null,
    });
  }

  markInvalid(id: string): void {
    this.repo.update(id, {
      status: "invalid",
      updatedAt: Date.now(),
      cooldownUntil: null,
    });
  }

  markSuccess(id: string, latencyMs: number, tokens: TokenDelta = {}): void {
    const credential = this.getOrThrow(id);
    const usage = credential.usage;
    const successes = usage.successfulRequests + 1;
    const averageLatencyMs =
      successes === 1
        ? latencyMs
        : Math.round((usage.averageLatencyMs * usage.successfulRequests + latencyMs) / successes);

    const inputTokens = tokens.inputTokens ?? 0;
    const outputTokens = tokens.outputTokens ?? 0;

    const next: UsageStats = {
      ...usage,
      requests: usage.requests + 1,
      successfulRequests: successes,
      inputTokens: usage.inputTokens + inputTokens,
      outputTokens: usage.outputTokens + outputTokens,
      totalTokens: usage.totalTokens + inputTokens + outputTokens,
      averageLatencyMs,
      lastUsedAt: Date.now(),
    };

    this.repo.update(id, {
      status: "healthy",
      usage: JSON.stringify(next),
      consecutiveFailures: 0,
      updatedAt: Date.now(),
    });
  }

  /**
   * Add upstream-reported token usage to a credential's counters.
   *
   * Called after a successful non-streamed response is parsed, because the
   * counts only exist in the response body.
   */
  recordTokens(id: string, tokens: TokenDelta): void {
    const inputTokens = tokens.inputTokens ?? 0;
    const outputTokens = tokens.outputTokens ?? 0;
    if (inputTokens === 0 && outputTokens === 0) return;

    const credential = this.get(id);
    if (!credential) return;

    const usage = credential.usage;
    this.repo.update(id, {
      usage: JSON.stringify({
        ...usage,
        inputTokens: usage.inputTokens + inputTokens,
        outputTokens: usage.outputTokens + outputTokens,
        totalTokens: usage.totalTokens + inputTokens + outputTokens,
      }),
      updatedAt: Date.now(),
    });
  }

  markFailure(id: string, classification: ErrorClassification): void {
    const credential = this.getOrThrow(id);
    const usage = credential.usage;
    const next: UsageStats = {
      ...usage,
      requests: usage.requests + 1,
      failedRequests: usage.failedRequests + 1,
      rateLimitErrors:
        usage.rateLimitErrors + (classification === "credential_rate_limited" ? 1 : 0),
      authErrors: usage.authErrors + (classification === "credential_invalid" ? 1 : 0),
      serverErrors:
        usage.serverErrors + (classification === "temporary_provider_error" ? 1 : 0),
      lastUsedAt: Date.now(),
    };
    this.repo.update(id, {
      usage: JSON.stringify(next),
      consecutiveFailures: credential.consecutiveFailures + 1,
      updatedAt: Date.now(),
    });
  }

  /** Returns the timestamp the credential becomes eligible again. */
  putInCooldown(id: string, retryAfterHeader?: string): number {
    const credential = this.getOrThrow(id);
    const until = this.cooldown.cooldownUntil(credential, retryAfterHeader);
    const usage = credential.usage;
    this.repo.update(id, {
      status: "cooldown",
      cooldownUntil: until,
      usage: JSON.stringify({ ...usage, cooldownCount: usage.cooldownCount + 1 }),
      updatedAt: Date.now(),
    });
    return until;
  }

  clearCooldown(id: string): void {
    const credential = this.get(id);
    if (!credential) return;
    this.repo.update(id, {
      status: credential.consecutiveFailures > 0 ? "unverified" : "healthy",
      cooldownUntil: null,
      updatedAt: Date.now(),
    });
  }

  /** Expire elapsed cooldowns so the UI and router see fresh state. */
  refreshCooldowns(now = Date.now()): number {
    let changed = 0;
    for (const credential of this.listAll()) {
      if (
        credential.status === "cooldown" &&
        credential.cooldownUntil !== undefined &&
        credential.cooldownUntil <= now
      ) {
        this.clearCooldown(credential.id);
        changed += 1;
      }
    }
    return changed;
  }

  setQuota(id: string, quota: QuotaInfo): void {
    this.repo.update(id, { quota: JSON.stringify(quota), updatedAt: Date.now() });
  }

  countsByProvider(): Map<string, { total: number; healthy: number }> {
    const out = new Map<string, { total: number; healthy: number }>();
    for (const row of this.repo.countsByProvider()) {
      out.set(row.provider_id, { total: row.total, healthy: row.healthy ?? 0 });
    }
    return out;
  }

  /** The only credential projection allowed to leave the process. */
  toPublic(credential: Credential): PublicCredential {
    return {
      id: credential.id,
      providerId: credential.providerId,
      accountId: maskAccountId(credential.accountId),
      maskedSecret: maskSecret(credential.secret),
      description: credential.description,
      status: credential.status,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
      lastVerifiedAt: credential.lastVerifiedAt,
      usage: credential.usage,
      quota: credential.quota,
      cooldownUntil: credential.cooldownUntil,
      consecutiveFailures: credential.consecutiveFailures,
      proxy: describeProxy(credential.proxyUrl, credential.proxyAuto),
      rate: this.rates.snapshot(credential.id),
    };
  }

  private rowToCredential(row: CredentialRow): Credential {
    return {
      id: row.id,
      providerId: row.provider_id,
      accountId: row.account_id ?? undefined,
      secret: this.vault.decrypt(row.secret_encrypted),
      proxyUrl: row.proxy_url ?? undefined,
      proxyAuto: row.proxy_auto === 1,
      description: row.description,
      status: row.status as CredentialStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastVerifiedAt: row.last_verified_at ?? undefined,
      usage: JSON.parse(row.usage) as UsageStats,
      quota: row.quota ? (JSON.parse(row.quota) as QuotaInfo) : undefined,
      cooldownUntil: row.cooldown_until ?? undefined,
      consecutiveFailures: row.consecutive_failures,
    };
  }
}

/** Proxy state safe to display: never the proxy's own username or password. */
export function describeProxy(
  proxyUrl: string | undefined,
  auto = false,
): CredentialProxyInfo {
  if (!proxyUrl) return { configured: false, auto: false };
  const label = proxyLabel(proxyUrl);
  return label ? { configured: true, auto, label } : { configured: true, auto };
}

/** Re-export so callers can build an empty gauge without importing the types. */
export { emptyRate };
