import { randomUUID } from "node:crypto";
import type { ChainManager } from "../chains/manager.js";
import type { CredentialManager } from "../credentials/manager.js";
import type { CredentialSelector } from "../credentials/selector.js";
import type { CooldownManager } from "../credentials/cooldown.js";
import type { ProviderAdapter, SendResult, TransformContext } from "../providers/adapter.js";
import type { ProviderRegistry } from "../providers/registry.js";
import { getHeader } from "../providers/http.js";
import { proxyLabel } from "../providers/proxy.js";
import { parseQuota } from "../quota/parse.js";
import type { Logger } from "../logger.js";
import { maskSecret } from "../credentials/masking.js";
import type { RateTracker } from "../credentials/rate.js";
import type { EventBus } from "../events.js";
import { isRequestScoped, isRetryable } from "../errors/classify.js";
import type {
  Chain,
  ChainEntry,
  ChatCompletionRequest,
  Credential,
  ErrorClassification,
  FallbackPolicy,
  ProviderError,
} from "../types.js";

/** One recorded attempt, surfaced in error payloads and the request history. */
export interface AttemptLog {
  chainAlias: string;
  entryId: string;
  providerId: string;
  model: string;
  credentialId: string;
  description: string;
  classification: ErrorClassification | "skipped_cooldown" | "skipped_empty" | "retrying";
  status?: number;
  latencyMs?: number;
  at: number;
}

export interface RouteResult {
  response: Response;
  chainAlias: string;
  entryId: string;
  providerId: string;
  entryModel: string;
  credentialId: string;
  credentialDescription: string;
  fallback: boolean;
  fallbackReason?: string;
  attempts: AttemptLog[];
  /** Identity used when translating a non-OpenAI upstream response. */
  context: TransformContext;
}

export class AllChainsExhaustedError extends Error {
  constructor(
    readonly attempts: AttemptLog[],
    readonly lastError?: unknown,
    readonly routeInfo?: RouteErrorInfo,
  ) {
    super("All chains exhausted");
    this.name = "AllChainsExhaustedError";
  }
}

/**
 * Everything needed to narrate a request-level failure to a client.
 *
 * Attached to the routing errors the gateway throws, so an error response can
 * reuse the same `X-Cokey-*` transparency headers that a success does — the
 * coding tool can read which provider failed the same way it reads which one
 * succeeded.
 */
export interface RouteErrorInfo {
  chainAlias?: string;
  fallback: boolean;
  fallbackReason?: string;
}

/** A request-shaped failure. Rotation would fail identically, so we stop. */
export class RequestScopedError extends Error {
  constructor(
    readonly classification: ErrorClassification,
    readonly providerError: ProviderError,
    readonly attempts: AttemptLog[] = [],
  ) {
    super(providerError.message || classification);
    this.name = "RequestScopedError";
  }
}

export class ChainNotFoundError extends Error {
  constructor(alias: string) {
    super(`Chain not found: ${alias}`);
    this.name = "ChainNotFoundError";
  }
}

export class ChainDisabledError extends Error {
  constructor(alias: string) {
    super(`Chain is disabled: ${alias}`);
    this.name = "ChainDisabledError";
  }
}

export interface RouterOptions {
  /** Pause between bounded retries of the same credential. */
  retryDelayMs?: number;
  /** Injectable sleep so tests never actually wait. */
  sleep?: (ms: number) => Promise<void>;
}

/** Mutable bookkeeping for a single route() call. */
interface RouteState {
  attempts: AttemptLog[];
  fallback: boolean;
  fallbackReason?: string;
  lastError?: unknown;
}

type EntryOutcome =
  | { kind: "success"; result: RouteResult }
  /** This entry is done; the caller may try the next one. */
  | { kind: "next_entry" }
  /** Fallback is disabled or impossible; stop routing immediately. */
  | { kind: "stop" };

/**
 * The heart of COKEY.
 *
 * Routing priority is, without exception:
 *
 *     entry → credential → next credential → next entry
 *
 * **Invariant:** a lower-priority entry is never attempted while a
 * higher-priority entry still has an eligible, unattempted credential for the
 * current request. The only early exit from an entry is a definitive
 * request-level error (`context_too_large`, `invalid_request`), which aborts
 * routing entirely instead of rotating, or a `model_unavailable` verdict, which
 * skips the entry's remaining credentials because the model itself is wrong.
 */
export class RouterEngine {
  private readonly retryDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly chains: ChainManager,
    private readonly credentials: CredentialManager,
    private readonly providers: ProviderRegistry,
    private readonly cooldown: CooldownManager,
    private readonly selector: CredentialSelector,
    private readonly logger: Logger,
    /** Live feedback for the UI: route progress and key/model switches. */
    private readonly events: EventBus,
    /** Per-credential throughput gauge. */
    private readonly rates: RateTracker,
    private readonly policy: () => FallbackPolicy,
    options: RouterOptions = {},
  ) {
    this.retryDelayMs = options.retryDelayMs ?? 250;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /** Resolve a chain alias, or throw if unknown or disabled. */
  resolveChain(alias: string): Chain {
    const chain = this.chains.getChainByAlias(alias);
    if (!chain) throw new ChainNotFoundError(alias);
    if (!chain.enabled) throw new ChainDisabledError(alias);
    return chain;
  }

  async route(chainAlias: string, request: ChatCompletionRequest): Promise<RouteResult> {
    const policy = this.policy();
    const chain = this.resolveChain(chainAlias);
    const entries = this.chains.listEnabledEntries(chain.id);

    if (entries.length === 0) throw new AllChainsExhaustedError([], undefined, { fallback: false });

    const state: RouteState = { attempts: [], fallback: false };

    this.events.updateRoute({
      active: true,
      chainAlias,
      fallback: false,
      attempts: 0,
      startedAt: Date.now(),
      lastOutcome: undefined,
      lastClassification: undefined,
      lastFallbackReason: undefined,
    });
    this.events.emit({
      type: "route.start",
      level: "info",
      message: `Routing chain ${chainAlias}`,
      chainAlias,
      model: request.model,
    });

    for (const entry of entries) {
      const outcome = await this.tryEntry(chainAlias, entry, request, policy, state);

      if (outcome.kind === "success") return outcome.result;
      if (outcome.kind === "stop") break;
      if (!policy.entryFallback) break;
    }

    this.logger.warn("all chains exhausted", {
      chain: chainAlias,
      attempts: state.attempts.length,
      reason: state.fallbackReason,
    });

    this.events.updateRoute({
      active: false,
      lastOutcome: "error",
      lastFallbackReason: state.fallbackReason,
      attempts: state.attempts.length,
    });
    this.events.emit({
      type: "route.failure",
      level: "error",
      message: `All chains exhausted for ${chainAlias}`,
      chainAlias,
      classification: state.fallbackReason ?? "unknown",
      data: { attempts: state.attempts.length },
    });

    throw new AllChainsExhaustedError(state.attempts, state.lastError, {
      chainAlias,
      fallback: state.fallback,
      fallbackReason: state.fallbackReason,
    });
  }

  /** Walk every eligible credential of a single entry, in selector order. */
  private async tryEntry(
    chainAlias: string,
    entry: ChainEntry,
    request: ChatCompletionRequest,
    policy: FallbackPolicy,
    state: RouteState,
  ): Promise<EntryOutcome> {
    const ordered = this.selector.order(entry);

    if (ordered.length === 0) {
      const bound = this.selector.all(entry);
      state.attempts.push(
        this.attempt(chainAlias, entry, {
          credentialId: "-",
          description: "-",
          classification: bound.length === 0 ? "skipped_empty" : "skipped_cooldown",
        }),
      );
      if (bound.length === 0) return { kind: "next_entry" };

      // Every bound credential is cooling down, invalid or disabled.
      state.fallback = true;
      state.fallbackReason ??= "cooldown";
      return policy.credentialFallback ? { kind: "next_entry" } : { kind: "stop" };
    }

    for (const candidate of ordered) {
      // Re-read immediately before use: a concurrent request may have cooled
      // this credential down since the order was computed.
      const credential = this.credentials.get(candidate.id);
      if (!credential || this.cooldown.isInCooldown(credential)) {
        state.attempts.push(
          this.attempt(chainAlias, entry, {
            credentialId: candidate.id,
            description: candidate.description,
            classification: "skipped_cooldown",
          }),
        );
        state.fallback = true;
        state.fallbackReason ??= "cooldown";
        continue;
      }

      const adapter = this.providers.get(entry.providerId);
      const started = Date.now();

      this.announceAttempt(chainAlias, entry, credential, state);

      this.logger.info("request attempt", {
        chain: chainAlias,
        entry: entry.id,
        provider: entry.providerId,
        model: entry.model,
        credential: credential.description,
      });

      this.selector.acquire(entry.id, credential.id);
      let outcome: SendResult;
      try {
        outcome = await this.attemptWithRetries(
          adapter,
          entry,
          credential,
          request,
          chainAlias,
          policy,
          state,
        );
      } finally {
        this.selector.release(entry.id, credential.id);
      }

      if (outcome.ok) {
        const latencyMs = Date.now() - started;
        this.credentials.markSuccess(credential.id, latencyMs);
        this.recordQuota(adapter, credential, outcome.response);

        this.logger.info("request succeeded", {
          chain: chainAlias,
          entry: entry.id,
          credential: credential.description,
          latencyMs,
          fallback: state.fallback,
        });

        this.events.updateRoute({
          active: false,
          fallback: state.fallback,
          attempts: state.attempts.length,
          lastOutcome: "success",
          lastFallbackReason: state.fallbackReason,
        });
        this.events.emit({
          type: "route.success",
          level: "success",
          message: `${credential.description} answered with ${entry.model}`,
          chainAlias,
          providerId: entry.providerId,
          model: entry.model,
          credentialId: credential.id,
          credentialDescription: credential.description,
          proxyLabel: proxyLabel(credential.proxyUrl),
          data: { latencyMs, fallback: state.fallback },
        });

        return {
          kind: "success",
          result: {
            response: outcome.response,
            chainAlias,
            entryId: entry.id,
            providerId: entry.providerId,
            entryModel: entry.model,
            credentialId: credential.id,
            credentialDescription: credential.description,
            fallback: state.fallback,
            fallbackReason: state.fallbackReason,
            attempts: state.attempts,
            context: {
              model: entry.model,
              requestId: `chatcmpl-cokey-${randomUUID()}`,
              created: Math.floor(Date.now() / 1000),
            },
          },
        };
      }

      state.lastError = outcome.error;
      const classification = adapter.classifyError(outcome.error);

      state.attempts.push(
        this.attempt(chainAlias, entry, {
          credentialId: credential.id,
          description: credential.description,
          classification,
          status: outcome.error.status,
          latencyMs: Date.now() - started,
        }),
      );

      this.logger.warn("request attempt failed", {
        chain: chainAlias,
        entry: entry.id,
        credential: credential.description,
        classification,
        status: outcome.error.status,
      });

      this.events.emit({
        type: "route.failure",
        level: classification === "temporary_provider_error" ? "warn" : "error",
        message: `${credential.description} failed (${classification})`,
        chainAlias,
        providerId: entry.providerId,
        model: entry.model,
        credentialId: credential.id,
        credentialDescription: credential.description,
        classification,
        status: outcome.error.status,
      });

      if (isRequestScoped(classification)) {
        this.logger.info("request scoped error; stopping rotation", { classification });
        this.events.updateRoute({
          active: false,
          lastOutcome: "error",
          lastClassification: classification,
          attempts: state.attempts.length,
        });
        throw new RequestScopedError(classification, outcome.error, state.attempts);
      }

      if (
        classification === "model_unavailable" ||
        classification === "context_too_large" ||
        classification === "invalid_request"
      ) {
        state.fallback = true;
        state.fallbackReason ??= reasonFor(classification);
        // The model is wrong, unavailable, or can't handle this request:
        // skip straight to the next entry — a different model may work.
        return policy.entryFallback ? { kind: "next_entry" } : { kind: "stop" };
      }

      if (!policy.credentialFallback) {
        this.credentials.markFailure(credential.id, classification);
        state.fallback = true;
        state.fallbackReason ??= reasonFor(classification);
        return { kind: "stop" };
      }

      this.applyClassification(credential, classification, outcome.error, state);
    }

    return { kind: "next_entry" };
  }

  /** Side effects for a credential-scoped failure, then the caller rotates. */
  private applyClassification(
    credential: Credential,
    classification: ErrorClassification,
    error: ProviderError,
    state: RouteState,
  ): void {
    switch (classification) {
      case "credential_rate_limited":
      case "quota_exhausted": {
        const retryAfter = getHeader(error.headers, "retry-after");
        const until = this.credentials.putInCooldown(credential.id, retryAfter);
        this.credentials.markFailure(credential.id, classification);
        this.rates.recordRateLimited(credential.id);
        this.logger.info("credential cooling down", {
          credential: credential.description,
          cooldownMs: until - Date.now(),
        });
        this.events.emit({
          type: "credential.cooldown",
          level: "warn",
          message: `${credential.description} cooling down for ${Math.round((until - Date.now()) / 1000)}s`,
          providerId: credential.providerId,
          credentialId: credential.id,
          credentialDescription: credential.description,
          classification,
          data: { cooldownUntil: until },
        });
        state.fallback = true;
        state.fallbackReason ??= classification === "quota_exhausted" ? "quota" : "rate_limit";
        return;
      }

      case "credential_invalid": {
        this.credentials.markInvalid(credential.id);
        this.credentials.markFailure(credential.id, classification);
        this.events.emit({
          type: "credential.invalid",
          level: "error",
          message: `${credential.description} was rejected by the provider`,
          providerId: credential.providerId,
          credentialId: credential.id,
          credentialDescription: credential.description,
          classification,
        });
        state.fallback = true;
        state.fallbackReason ??= "credential_invalid";
        return;
      }

      default: {
        this.credentials.markFailure(credential.id, classification);
        state.fallback = true;
        state.fallbackReason ??= reasonFor(classification);
        return;
      }
    }
  }

  /**
   * Attempt one credential, retrying only transient failures and only up to the
   * configured bound. Request-shaped and credential-shaped errors are returned
   * to the caller immediately.
   */
  private async attemptWithRetries(
    adapter: ProviderAdapter,
    entry: ChainEntry,
    credential: Credential,
    request: ChatCompletionRequest,
    chainAlias: string,
    policy: FallbackPolicy,
    state: RouteState,
  ): Promise<SendResult> {
    let retries = 0;

    for (;;) {
      let result: SendResult;
      try {
        result = await adapter.send(entry, credential, request);
      } catch (error) {
        result = { ok: false, error: { message: (error as Error).message } };
      }

      if (result.ok) return result;

      const classification = adapter.classifyError(result.error);
      if (!isRetryable(classification) || retries >= policy.maxRetriesPerCredential) {
        return result;
      }

      retries += 1;
      state.attempts.push(
        this.attempt(chainAlias, entry, {
          credentialId: credential.id,
          description: credential.description,
          classification: "retrying",
          status: result.error.status,
        }),
      );

      this.logger.debug("retrying transient failure", {
        credential: credential.description,
        classification,
        retry: retries,
      });

      await this.sleep(this.retryDelayMs * retries);
    }
  }

  private recordQuota(adapter: ProviderAdapter, credential: Credential, response: Response): void {
    try {
      const quota = adapter.parseQuotaResponse
        ? adapter.parseQuotaResponse(response)
        : parseQuota(response.headers);
      if (quota.available) this.credentials.setQuota(credential.id, quota);
    } catch {
      // Quota parsing is cosmetic; never fail a successful request for it.
    }
  }

  /**
   * Publish the credential about to serve, and flag a switch when the target
   * differs from the previous attempt of this route.
   *
   * This is what powers the "key changed" / "model changed" notifications: a
   * client cannot see a rotation happen, so the gateway narrates it.
   */
  private announceAttempt(
    chainAlias: string,
    entry: ChainEntry,
    credential: Credential,
    state: RouteState,
  ): void {
    const previousRoute = this.events.routeSnapshot();
    const switching =
      state.attempts.length > 0 &&
      (previousRoute.providerId !== entry.providerId ||
        previousRoute.model !== entry.model ||
        previousRoute.credentialId !== credential.id);

    const proxy = proxyLabel(credential.proxyUrl);
    this.rates.record(credential.id);

    this.events.updateRoute({
      active: true,
      chainAlias,
      providerId: entry.providerId,
      model: entry.model,
      credentialId: credential.id,
      credentialDescription: credential.description,
      maskedSecret: maskSecret(credential.secret),
      proxyLabel: proxy,
      fallback: state.fallback,
      attempts: state.attempts.length,
    });

    if (switching) {
      const changedCredential = previousRoute.credentialId !== credential.id;
      const changedModel = previousRoute.model !== entry.model;
      const changedProvider = previousRoute.providerId !== entry.providerId;
      const parts = [
        changedProvider || changedModel
          ? `model → ${entry.providerId}/${entry.model}`
          : undefined,
        changedCredential ? `key → ${credential.description}` : undefined,
      ].filter(Boolean);

      this.events.emit({
        type: "route.switch",
        level: "warn",
        message: `Switched: ${parts.join(", ")}`,
        chainAlias,
        providerId: entry.providerId,
        model: entry.model,
        credentialId: credential.id,
        credentialDescription: credential.description,
        proxyLabel: proxy,
        previous: {
          providerId: previousRoute.providerId,
          model: previousRoute.model,
          credentialId: previousRoute.credentialId,
          credentialDescription: previousRoute.credentialDescription,
        },
        data: { changedModel, changedCredential, changedProvider },
      });

      // A second, plainly worded event for clients that want to raise a
      // notification rather than an error. Editor integrations show this as an
      // informational toast: the request still succeeds, only the path moved.
      this.events.emit({
        type: "chain.state",
        level: "info",
        message: `chain changed state: ${chainAlias} on ${entry.providerId}/${entry.model} via ${credential.description}`,
        chainAlias,
        providerId: entry.providerId,
        model: entry.model,
        credentialId: credential.id,
        credentialDescription: credential.description,
        proxyLabel: proxy,
        previous: {
          providerId: previousRoute.providerId,
          model: previousRoute.model,
          credentialId: previousRoute.credentialId,
          credentialDescription: previousRoute.credentialDescription,
        },
        data: { changedModel, changedCredential, changedProvider, notify: true },
      });
    }

    this.events.emit({
      type: "route.attempt",
      level: "info",
      message: `Trying ${entry.providerId}/${entry.model} with ${credential.description}`,
      chainAlias,
      providerId: entry.providerId,
      model: entry.model,
      credentialId: credential.id,
      credentialDescription: credential.description,
      proxyLabel: proxy,
    });
  }

  private attempt(
    chainAlias: string,
    entry: ChainEntry,
    values: {
      credentialId: string;
      description: string;
      classification: AttemptLog["classification"];
      status?: number;
      latencyMs?: number;
    },
  ): AttemptLog {
    return {
      chainAlias,
      entryId: entry.id,
      providerId: entry.providerId,
      model: entry.model,
      credentialId: values.credentialId,
      description: values.description,
      classification: values.classification,
      status: values.status,
      latencyMs: values.latencyMs,
      at: Date.now(),
    };
  }
}

function reasonFor(classification: ErrorClassification): string {
  switch (classification) {
    case "temporary_provider_error":
      return "provider_error";
    case "network_error":
      return "network_error";
    case "context_too_large":
      return "context_too_large";
    case "invalid_request":
      return "invalid_request";
    case "model_unavailable":
      return "model_unavailable";
    default:
      return "provider_error";
  }
}
