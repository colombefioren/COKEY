import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { ApiKeyService, type ApiKeyView, type CreatedApiKey } from "./api-keys.js";
import { ApiKeysRepo } from "./db/api-keys.repo.js";
import { PROVIDER_ALIASES } from "../catalog/providers.js";
import type { ProviderCatalogEntry, ProviderStatus } from "../catalog/types.js";
import { ApiStyleSchema, AuthSchemeSchema } from "./validation/schemas.js";
import { ChainsRepo } from "./db/chains.repo.js";
import { CredentialsRepo } from "./db/credentials.repo.js";
import { CustomEndpointsRepo } from "./db/custom-endpoints.repo.js";
import { DatabaseClient } from "./db/database.js";
import { ProviderModelsRepo, type ProviderModelRecord } from "./db/provider-models.repo.js";
import { ModelProbesRepo } from "./db/model-probes.repo.js";
import { ProxyPoolRepo } from "./db/proxy-pool.repo.js";
import { RequestsRepo } from "./db/requests.repo.js";
import { SettingsRepo } from "./db/settings.repo.js";
import { ChainManager } from "./chains/manager.js";
import { CredentialManager } from "./credentials/manager.js";
import { CooldownManager } from "./credentials/cooldown.js";
import { RateTracker } from "./credentials/rate.js";
import { CredentialSelector } from "./credentials/selector.js";
import { EventBus, type CokeyEvent } from "./events.js";
import {
  CmsStore,
  curateProvider,
  rankingsView,
  undocumentedProviders,
  type CmsStatus,
  type CmsTermsSection,
  type CuratedDossier,
  type RankingsView,
} from "./cms/index.js";
import { parseProxyUrl, proxyLabel } from "./providers/proxy.js";
import { checkProxyUrl, collectHealthy } from "./providers/proxy-health.js";
import {
  ProxyPoolService,
  type ProxyPoolStatus,
  type ProxyPoolView,
} from "./providers/proxy-pool.js";
import { fetchProxiflyFreeList, parseProxiflyList } from "./providers/proxifly.js";
import {
  modelAvailability,
  staleCuratedModels,
  type ModelCatalogView,
} from "./models/availability.js";
import {
  isTrustworthyListing,
  normaliseModelIds,
  reconcileModels,
  type ModelDiscoveryReport,
} from "./models/discovery.js";
import {
  CONTENT_FRESHNESS_DAYS,
  deriveGuidance,
  guidanceSummary,
  type GuidanceInput,
  type GuidanceNotice,
  type GuidanceSeverity,
} from "./guidance.js";
import { emptyUsage } from "./types.js";
import { SecretVault } from "./crypto/secrets.js";
import { RequestHistory, type HistoryStats } from "./history.js";
import { Logger } from "./logger.js";
import { ProviderRegistry } from "./providers/registry.js";
import { RouterEngine, type RouteResult } from "./router/engine.js";
import { InvalidSettingError, SettingsService } from "./settings.js";
import { assertSafeEndpoint } from "./security/ssrf.js";
import type {
  Chain,
  ChainEntry,
  ChatCompletionRequest,
  Credential,
  ErrorClassification,
  LogLevel,
  ModelInfo,
  PublicCredential,
  RoutingStrategy,
  Settings,
  ValidationResult,
} from "./types.js";
import {
  PROBE_MESSAGE,
  probeEntry,
  selectProbeCredential,
  type ModelProbeResult,
} from "./models/probe.js";

export interface CokeyOptions {
  port?: number;
  host?: string;
  dataDir?: string;
  logLevel?: LogLevel;
  /** Injectable environment, primarily for tests. */
  env?: NodeJS.ProcessEnv;
  /** Silence logs in tests. */
  silent?: boolean;
}

export interface AddChainInput {
  alias: string;
  description?: string;
  entries: Array<{
    provider: string;
    model: string;
    routingStrategy?: RoutingStrategy;
    credentials: Array<{
      secret?: string;
      /** Read the secret from this environment variable instead. */
      env?: string;
      description: string;
      accountId?: string;
      /** Keep the credential even if verification fails transiently. */
      addAnyway?: boolean;
    }>;
  }>;
}

export interface ConnectProviderInput {
  secret: string;
  description: string;
  accountId?: string;
  /** Optional egress proxy, so this key leaves through its own IP. */
  proxyUrl?: string;
  /** Keep an unverifiable key: save it as unverified instead of rejecting. */
  saveAnyway?: boolean;
  /**
   * Route the verification probe through the automatic egress pool.
   * Defaults to true: a probe should reflect what production will do.
   */
  useProxy?: boolean;
}

export interface ConnectProviderResult {
  credential: PublicCredential;
  validation: ValidationResult;
  /**
   * What the provider reported serving, once the key was accepted.
   *
   * A freshly connected key is the first moment COKEY can ask the provider what
   * it actually serves, so the answer travels back with the connect response
   * instead of being something the user has to go and request. Absent when the
   * key did not verify or the provider could not be asked.
   */
  models?: ModelDiscoveryReport;
}

export interface ChainEntryView extends ChainEntry {
  credentials: PublicCredential[];
  healthyCount: number;
  cooldownCount: number;
  provider?: ProviderCatalogEntry;
}

export interface ChainView extends Chain {
  entries: ChainEntryView[];
}

export interface CustomEndpointInput {
  displayName: string;
  baseUrl: string;
  apiStyle: string;
  authScheme: string;
  models?: string[];
}

export interface FreeProviderNudge {
  connectedFree: number;
  target: number;
  suggestions: ProviderCatalogEntry[];
}

/** One usable model, ranked by this user's own probe history. */
export interface MyModelRanking {
  providerId: string;
  displayName: string;
  model: string;
  attempts: number;
  successes: number;
  /** 0-1. Undefined when never probed. */
  successRate?: number;
  avgLatencyMs?: number;
  lastCheckedAt?: number;
  lastOk?: boolean;
}

export class BadCredentialError extends Error {
  constructor(
    message: string,
    readonly classification: string,
  ) {
    super(message);
    this.name = "BadCredentialError";
  }
}

/**
 * The COKEY application.
 *
 * This class owns every long-lived object - database, vault, managers, router -
 * and is the single entry point used by the HTTP server, the CLI and the public
 * programmatic API. Nothing here knows about HTTP.
 */
export class Cokey {
  readonly dataDir: string;
  readonly db: DatabaseClient;
  readonly vault: SecretVault;
  readonly logger: Logger;

  readonly settingsRepo: SettingsRepo;
  readonly credentialsRepo: CredentialsRepo;
  readonly chainsRepo: ChainsRepo;
  readonly requestsRepo: RequestsRepo;
  readonly customEndpointsRepo: CustomEndpointsRepo;
  readonly providerModelsRepo: ProviderModelsRepo;
  readonly modelProbesRepo: ModelProbesRepo;
  readonly proxyPoolRepo: ProxyPoolRepo;
  readonly apiKeysRepo: ApiKeysRepo;
  readonly apiKeys: ApiKeyService;
  /** Automatic per-credential egress, so one provider's keys do not share an IP. */
  readonly proxyPool: ProxyPoolService;

  readonly settingsService: SettingsService;
  readonly cooldown: CooldownManager;
  readonly credentials: CredentialManager;
  readonly chains: ChainManager;
  readonly providers: ProviderRegistry;
  readonly selector: CredentialSelector;
  readonly router: RouterEngine;
  readonly history: RequestHistory;
  /**
   * The curated content repository: provider dossiers, terms and rankings.
   *
   * It is optional by design. With no content checkout beside COKEY the compiled
   * catalog is served instead, so a fresh clone is useful with zero setup.
   */
  readonly cms: CmsStore;
  /** Live routing narration: what is running now, and every switch. */
  readonly events = new EventBus();
  /** Locally measured per-credential throughput. */
  readonly rates = new RateTracker();

  private started = false;
  private sweeper?: NodeJS.Timeout;

  constructor(options: CokeyOptions = {}) {
    const env = options.env ?? process.env;
    this.dataDir = options.dataDir ?? env.COKEY_DATA_DIR ?? join(process.cwd(), ".cokey");
    mkdirSync(this.dataDir, { recursive: true });

    this.db = new DatabaseClient(join(this.dataDir, "cokey.db"));
    this.vault = new SecretVault({ dataDir: this.dataDir });
    this.logger = new Logger(options.silent ? "error" : (options.logLevel ?? "info"), {
      write: options.silent ? () => {} : (line) => console.error(line),
    });

    this.settingsRepo = new SettingsRepo(this.db);
    this.credentialsRepo = new CredentialsRepo(this.db);
    this.chainsRepo = new ChainsRepo(this.db);
    this.requestsRepo = new RequestsRepo(this.db);
    this.customEndpointsRepo = new CustomEndpointsRepo(this.db);
    this.providerModelsRepo = new ProviderModelsRepo(this.db);
    this.modelProbesRepo = new ModelProbesRepo(this.db);
    this.proxyPoolRepo = new ProxyPoolRepo(this.db);
    this.proxyPool = new ProxyPoolService(this.proxyPoolRepo);
    this.apiKeysRepo = new ApiKeysRepo(this.db);
    this.apiKeys = new ApiKeyService(this.apiKeysRepo);

    this.settingsService = new SettingsService(this.settingsRepo, env);
    if (options.dataDir || options.port || options.host || options.logLevel) {
      this.settingsService.update({
        ...(options.dataDir ? { dataDir: this.dataDir } : {}),
        ...(options.port !== undefined ? { port: options.port } : {}),
        ...(options.host !== undefined ? { host: options.host } : {}),
        ...(options.logLevel !== undefined ? { logLevel: options.logLevel } : {}),
      });
    }
    this.logger.setLevel(this.settings.logLevel);

    this.cooldown = new CooldownManager({
      baseMs: 30_000,
      maxMs: 300_000,
      jitterRatio: 0.15,
    });

    this.credentials = new CredentialManager(
      this.credentialsRepo,
      this.vault,
      this.cooldown,
      this.rates,
    );
    this.chains = new ChainManager(this.chainsRepo);
    this.providers = new ProviderRegistry(this.customEndpointsRepo.list());
    this.selector = new CredentialSelector(this.credentials, this.cooldown);
    this.history = new RequestHistory(this.requestsRepo);

    // The store starts watching in `start()`; a reload that changes something
    // visible is announced on the event bus so every open dashboard refetches
    // without a reload.
    this.cms = new CmsStore({
      env,
      onChange: (snapshot) => {
        const counts = snapshot.providers.size;
        this.events.emit({
          type: "content.updated",
          level: "info",
          message: counts
            ? `Content reloaded: ${counts} provider dossier(s)`
            : "Content reloaded: no provider dossiers found",
          data: { providers: counts, terms: snapshot.terms.length },
        });
      },
    });

    // A pool supplied through the environment is seeded once; the UI can add,
    // disable and remove entries afterwards without touching the database by
    // hand.
    this.proxyPool.addMany(env.COKEY_PROXY_POOL);
    this.router = new RouterEngine(
      this.chains,
      this.credentials,
      this.providers,
      this.cooldown,
      this.selector,
      this.logger,
      this.events,
      this.rates,
      () => this.settings.fallback,
    );
  }

  get settings(): Settings {
    return this.settingsService.get();
  }

  // ---- lifecycle ----------------------------------------------------------

  start(): void {
    if (this.started) return;
    this.started = true;
    this.syncProxyAssignments();
    this.cms.watch();

    // Expire elapsed cooldowns so the UI and router always see fresh state.
    this.sweeper = setInterval(() => {
      try {
        const changed = this.credentials.refreshCooldowns();
        if (changed > 0) {
          this.logger.debug("cooldowns expired", { changed });
          this.events.emit({
            type: "credential.updated",
            level: "info",
            message: `${changed} credential(s) left cooldown`,
            data: { changed },
          });
        }
      } catch (error) {
        this.logger.error("cooldown sweep failed", { message: (error as Error).message });
      }
    }, 15_000);
    this.sweeper.unref?.();
  }

  stop(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = undefined;
    this.cms.close();
    this.db.close();
    this.started = false;
  }

  // ---- curated content ----------------------------------------------------

  /**
   * The dossier for a provider, content repository first.
   *
   * A dossier is an opinion with an argument, and both live in the content
   * repository so they can be corrected without a release. Everything the
   * repository does not state falls back to the compiled catalog.
   */
  curateProvider(providerId: string): CuratedDossier {
    return curateProvider(providerId, this.cms.current);
  }

  /** The ranking boards, from the content repository when it has them. */
  rankings(): RankingsView {
    return rankingsView(this.cms.current);
  }

  /** The terms document, in reading order. Empty when no content is checked out. */
  termsSections(): CmsTermsSection[] {
    return this.cms.current.terms;
  }

  /** Providers the content repository documents but this build cannot serve. */
  undocumentedProviders(): string[] {
    return undocumentedProviders(
      this.cms.current,
      this.providers.getCatalog().map((entry) => entry.id),
    );
  }

  /** Re-read the content directory on demand. Returns whether anything changed. */
  reloadContent(): boolean {
    return this.cms.reload();
  }

  contentStatus(): CmsStatus {
    return this.cms.status();
  }

  // ---- providers ----------------------------------------------------------

  /** Catalog entries annotated with the user's connection state. */
  providerStatuses(): ProviderStatus[] {
    const counts = this.credentials.countsByProvider();
    return this.providers.getCatalog().map((entry) => {
      // Keys connected under a collapsed id still count for the surviving one.
      const aliases = [entry.id];
      for (const [alias, target] of PROVIDER_ALIASES) {
        if (target === entry.id) aliases.push(alias);
      }
      const count = aliases
        .map((id) => counts.get(id))
        .reduce<{ total: number; healthy: number } | undefined>((sum, part) => {
          if (!part) return sum;
          return {
            total: (sum?.total ?? 0) + part.total,
            healthy: (sum?.healthy ?? 0) + part.healthy,
          };
        }, undefined);
      return {
        ...entry,
        connected: (count?.total ?? 0) > 0,
        credentialCount: count?.total ?? 0,
        healthyCount: count?.healthy ?? 0,
      };
    });
  }

  /**
   * Ask a provider what it currently serves, and reconcile that with what COKEY
   * believed it served.
   *
   * This is the only place the curated catalog meets reality. The catalog is a
   * hand-written default and is right most of the time; a model listing is right
   * now. When they disagree the listing wins, because a model the provider has
   * retired cannot serve a request no matter what a document says.
   *
   * Failure is always reported rather than thrown, and never destroys the
   * inventory already held — see the empty-listing guard below for why.
   */
  async refreshProviderModels(
    providerId: string,
    options: { credentialId?: string; retainMissingMs?: number; timeoutMs?: number } = {},
  ): Promise<ModelDiscoveryReport> {
    const catalog = this.providers.findCatalogEntry(providerId);
    const displayName = catalog?.displayName ?? providerId;
    const previous = this.providerModelsRepo.listByProvider(providerId);
    const checkedAt = Date.now();

    const refuse = (message: string, latencyMs = 0): ModelDiscoveryReport => ({
      providerId,
      displayName,
      ok: false,
      message,
      latencyMs,
      checkedAt,
      discovered: 0,
      tracked: previous.length,
      added: [],
      restored: [],
      removed: [],
      pruned: 0,
      stale: [],
      uncurated: [],
      unchanged: 0,
    });

    if (!catalog) return refuse(`Unknown provider: ${providerId}`);

    const bound = this.credentials.listByProvider(providerId);
    if (bound.length === 0) return refuse(`${displayName} has no connected key`);

    const credential = selectProbeCredential(bound, options.credentialId);
    if (!credential) return refuse(`No usable key for ${displayName}`);

    const started = Date.now();
    let listing: ModelInfo[];
    try {
      listing = await this.providers
        .get(providerId)
        .listModels(credential, { timeoutMs: options.timeoutMs });
    } catch (error) {
      return refuse(`Could not list models: ${(error as Error).message}`, Date.now() - started);
    }
    const latencyMs = Date.now() - started;

    const discovered = normaliseModelIds(listing.map((model) => model.id));

    if (!isTrustworthyListing(discovered)) {
      // A 200 with an empty list is not evidence that a provider stopped serving
      // everything. Storing it would detach every model of this provider from
      // every chain that uses one, so it is refused and the previous inventory
      // is left exactly as it was.
      return refuse(`${displayName} returned no models — inventory left untouched`, latencyMs);
    }

    const { records, changes } = reconcileModels({
      providerId,
      curated: catalog.knownModels,
      discovered,
      previous,
      now: checkedAt,
      retainMissingMs: options.retainMissingMs,
    });

    this.providerModelsRepo.replace(providerId, records);

    const report: ModelDiscoveryReport = {
      providerId,
      displayName,
      ok: true,
      latencyMs,
      checkedAt,
      discovered: discovered.length,
      tracked: records.length,
      ...changes,
    };

    // Only a real change is worth interrupting the UI for. A periodic sweep that
    // found what it expected should be silent.
    const touched = changes.added.length + changes.restored.length + changes.removed.length;
    if (touched > 0) {
      this.events.emit({
        type: "models.updated",
        level: changes.removed.length > 0 ? "warn" : "success",
        message: describeModelChange(displayName, changes),
        providerId,
        data: {
          added: changes.added,
          restored: changes.restored,
          removed: changes.removed,
          stale: changes.stale,
          uncurated: changes.uncurated,
          discovered: discovered.length,
        },
      });
    }

    this.logger.debug("model inventory refreshed", {
      provider: providerId,
      discovered: discovered.length,
      added: changes.added.length,
      removed: changes.removed.length,
      stale: changes.stale.length,
      latencyMs,
    });

    return report;
  }

  /**
   * Refresh every provider that has at least one connected key.
   *
   * Bounded concurrency, not fully sequential: a handful of these are
   * third-party endpoints being asked an administrative question, and firing
   * all of them at once is the behaviour that gets a free tier rate-limited
   * for reasons that have nothing to do with the user's traffic. But strictly
   * one-at-a-time meant a single unresponsive provider — a free tier that
   * hangs rather than errors — held up every provider behind it for the full
   * completion timeout (120s), which made a "re-check everything" click feel
   * like it had frozen. A small pool bounds the fan-out, and a much shorter
   * per-call timeout is enough for a cheap `GET /models`: a provider that
   * cannot answer that in a few seconds is not one worth waiting two minutes
   * on when there are others still to check.
   */
  async refreshAllProviderModels(
    options: { retainMissingMs?: number; concurrency?: number } = {},
  ): Promise<ModelDiscoveryReport[]> {
    const queue = this.providerStatuses().filter((provider) => provider.credentialCount > 0);
    const concurrency = Math.max(1, options.concurrency ?? 4);
    const timeoutMs = 15_000;
    const reports: ModelDiscoveryReport[] = new Array(queue.length);

    let next = 0;
    const worker = async () => {
      for (;;) {
        const index = next++;
        if (index >= queue.length) return;
        reports[index] = await this.refreshProviderModels(queue[index]!.id, {
          retainMissingMs: options.retainMissingMs,
          timeoutMs,
        });
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
    return reports;
  }

  /**
   * Refresh a provider's inventory in the background.
   *
   * Used where the refresh is a bonus rather than the point of the action —
   * re-verifying an existing key, for instance — so the response is not held up
   * by a second round trip to the provider.
   */
  private scheduleModelDiscovery(providerId: string, credentialId?: string): void {
    void this.refreshProviderModels(providerId, { credentialId }).catch((error) => {
      this.logger.warn("model discovery failed", {
        provider: providerId,
        message: (error as Error).message,
      });
    });
  }

  /** Observed model inventory, grouped by provider. */
  private inventoryByProvider(): Map<string, ProviderModelRecord[]> {
    const map = new Map<string, ProviderModelRecord[]>();
    for (const record of this.providerModelsRepo.listAll()) {
      const list = map.get(record.providerId);
      if (list) list.push(record);
      else map.set(record.providerId, [record]);
    }
    return map;
  }

  /**
   * Connect a credential, verifying it first.
   *
   * The credential is only persisted as healthy when the provider accepts it.
   * An outright rejection rolls the row back so a typo never lingers in the UI.
   */
  async connectProvider(
    providerId: string,
    input: ConnectProviderInput,
  ): Promise<ConnectProviderResult> {
    const catalog = this.providers.findCatalogEntry(providerId);
    if (!catalog) throw new Error(`Unknown provider: ${providerId}`);
    if (catalog.credentialFields.includes("accountId") && !input.accountId) {
      throw new Error(`${catalog.displayName} requires an account id`);
    }

    const credential = this.credentials.create({
      providerId,
      accountId: input.accountId,
      secret: input.secret,
      description: input.description,
      proxyUrl: input.proxyUrl,
      proxyAuto: false,
    });

    // A key only becomes independent of its siblings once it leaves through
    // its own exit IP, so the pool is re-planned the moment a key appears.
    this.syncProxyAssignments();

    const adapter = this.providers.get(providerId);
    const exit = this.resolveProbeProxy(credential, input.useProxy !== false);
    if (exit) credential.proxyUrl = exit;
    const validation = await adapter.validateCredential(credential);

    if (validation.ok) {
      this.credentials.markVerified(credential.id);
      this.events.emit({
        type: "credential.verified",
        level: "success",
        message: `${input.description} verified for ${catalog.displayName}`,
        providerId,
        credentialId: credential.id,
        credentialDescription: input.description,
        proxyLabel: proxyLabel(credential.proxyUrl),
      });
    } else if (
      validation.classification === "credential_rate_limited" ||
      validation.classification === "quota_exhausted"
    ) {
      this.credentials.putInCooldown(credential.id);
    } else if (validation.classification === "network_error") {
      // Transient: keep it, but clearly unverified. The caller decides whether
      // to keep it ("Retry" or "Add anyway").
      this.credentials.setStatus(credential.id, "unverified");
    } else if (input.saveAnyway) {
      // Explicit override: the user chose to save this key regardless of the
      // probe verdict. Keep it, clearly marked unverified.
      this.credentials.setStatus(credential.id, "unverified");
    } else {
      this.credentials.delete(credential.id);
      throw new BadCredentialError(
        validation.message ?? `${catalog.displayName} rejected this credential`,
        validation.classification,
      );
    }

    this.logger.info("provider connected", {
      provider: providerId,
      credential: input.description,
      status: validation.classification,
      latencyMs: validation.latencyMs,
    });

    // A key that just verified is the first moment this provider can be asked
    // what it really serves. Awaited so the answer can travel back with the
    // response, but never fatal: a provider that cannot list its models still
    // has a working key, and the catalog remains the fallback truth.
    let models: ModelDiscoveryReport | undefined;
    if (validation.ok) {
      try {
        models = await this.refreshProviderModels(providerId, { credentialId: credential.id });
      } catch (error) {
        this.logger.warn("model discovery failed", {
          provider: providerId,
          message: (error as Error).message,
        });
      }
    }

    return {
      credential: this.credentials.toPublic(this.credentials.getOrThrow(credential.id)),
      validation,
      models,
    };
  }

  /**
   * Probe a raw secret without persisting anything.
   *
   * Backs the separate "Test" button: the verdict appears in the UI, and the
   * key is only stored when the user then confirms with "Save". This is the
   * mirror of `connectProvider` that never writes a row and never throws for a
   * rejected key - rejection is reported as `ok: false`.
   */
  async testProviderSecret(
    providerId: string,
    input: { secret: string; accountId?: string; model?: string; useProxy?: boolean },
  ): Promise<ValidationResult> {
    const catalog = this.providers.findCatalogEntry(providerId);
    if (!catalog) throw new Error(`Unknown provider: ${providerId}`);

    // A transient credential drives the same probe paths as a stored row,
    // without ever touching the vault or the database.
    const credential: Credential = {
      id: "probe",
      providerId,
      accountId: input.accountId,
      secret: input.secret,
      description: "probe",
      status: "unverified",
      consecutiveFailures: 0,
      usage: emptyUsage(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // The probe leaves through the exit this key would get from the pool, so
    // "Test" reflects what production requests will actually do. An explicit
    // proxyUrl on the input is honored first.
    const probeExit = this.resolveProbeProxy(credential, input.useProxy !== false);
    if (probeExit) credential.proxyUrl = probeExit;

    if (input.model) return this.verifyCredential(providerId, input.model, credential);
    return this.providers.get(providerId).validateCredential(credential);
  }

  /** Re-run verification for a stored credential. */
  async testCredential(credentialId: string): Promise<ValidationResult> {
    const credential = this.credentials.getOrThrow(credentialId);
    const adapter = this.providers.get(credential.providerId);
    const validation = await adapter.validateCredential(credential);

    if (validation.ok) {
      this.credentials.markVerified(credential.id);
      this.events.emit({
        type: "credential.verified",
        level: "success",
        message: `${credential.description} verified`,
        providerId: credential.providerId,
        credentialId: credential.id,
        credentialDescription: credential.description,
      });
      // A key that just came back to life may have a provider behind it that
      // changed its model list while the key was down.
      this.scheduleModelDiscovery(credential.providerId, credential.id);
    } else if (validation.classification === "credential_invalid") {
      this.credentials.markInvalid(credential.id);
      this.events.emit({
        type: "credential.invalid",
        level: "error",
        message: `${credential.description} was rejected`,
        providerId: credential.providerId,
        credentialId: credential.id,
        credentialDescription: credential.description,
        classification: validation.classification,
      });
    } else if (
      validation.classification === "quota_exhausted" ||
      validation.classification === "credential_rate_limited"
    ) {
      this.credentials.putInCooldown(credential.id);
      this.credentials.markFailure(credential.id, validation.classification);
      this.events.emit({
        type: "credential.cooldown",
        level: "warn",
        message: `${credential.description} ${validation.classification === "quota_exhausted" ? "quota exhausted" : "rate limited"} — cooling down`,
        providerId: credential.providerId,
        credentialId: credential.id,
        credentialDescription: credential.description,
        classification: validation.classification,
      });
    }

    return validation;
  }

  /**
   * Prove an entry's model is operational with one of its own keys.
   *
   * The best-ranked bound credential is probed against the entry's exact model,
   * and the verdict updates that credential's state so the result is durable.
   */
  async testEntry(entryId: string): Promise<ValidationResult & { credentialId?: string }> {
    const entry = this.chains.getEntryOrThrow(entryId);
    const credentials = this.credentials.listByIds(entry.credentialIds);

    if (credentials.length === 0) {
      return { ok: false, classification: "unknown", message: "No keys bound to this entry" };
    }

    const rank = (credential: Credential): number =>
      credential.status === "healthy" ? 0 : credential.status === "cooldown" ? 1 : 2;
    const credential = [...credentials].sort((a, b) => rank(a) - rank(b))[0]!;

    const validation = await this.verifyCredential(entry.providerId, entry.model, credential);

    if (validation.ok) {
      this.credentials.markVerified(credential.id);
    } else if (validation.classification === "credential_invalid") {
      this.credentials.markInvalid(credential.id);
      this.credentials.markFailure(credential.id, validation.classification);
    } else if (
      validation.classification === "credential_rate_limited" ||
      validation.classification === "quota_exhausted"
    ) {
      this.credentials.putInCooldown(credential.id);
      this.credentials.markFailure(credential.id, validation.classification);
    }

    return { ...validation, credentialId: credential.id };
  }

  /**
   * Point a credential at a different egress proxy, or back to direct traffic.
   *
   * Changing the exit IP mid-flight is safe: the next request picks up the new
   * dispatcher, while in-flight requests keep the connection they opened.
   */
  setCredentialProxy(credentialId: string, proxyUrl: string | null): PublicCredential {
    const credential = this.credentials.getOrThrow(credentialId);
    // Validate before persisting so a typo cannot silently disable a key.
    const parsed = parseProxyUrl(proxyUrl);
    // A hand-set proxy is permanent: the pool must never move this key again.
    this.credentials.markProxyManual(credentialId, parsed ? parsed.href : null);

    this.events.emit({
      type: "credential.updated",
      level: "info",
      message: parsed
        ? `${credential.description} now egresses via ${parsed.label}`
        : `${credential.description} reverted to direct egress`,
      providerId: credential.providerId,
      credentialId,
      credentialDescription: credential.description,
      proxyLabel: parsed?.label,
    });

    return this.credentials.toPublic(this.credentials.getOrThrow(credentialId));
  }

  // ---- automatic egress pool ----------------------------------------------

  /**
   * Re-plan every pool-owned credential so same-provider keys never share an
   * exit IP.
   *
   * Called after a key is added or removed and whenever the pool changes. It
   * is deliberately cheap and idempotent: credentials whose proxy already
   * matches the plan are left untouched, and hand-set proxies are skipped
   * entirely.
   */
  syncProxyAssignments(): number {
    if (!this.settings.autoProxy) return 0;

    const poolSize = this.proxyPool.size();
    if (poolSize === 0) return 0;

    const plan = this.proxyPool.plan(this.credentialRefs(), this.settings.autoProxyStrategy);
    const byId = new Map(plan.map((entry) => [entry.credentialId, entry]));

    let changed = 0;
    for (const credential of this.credentials.listAll()) {
      const target = byId.get(credential.id);
      if (!target) continue;
      // Only pool-owned credentials move. `proxyAuto` is false for a key the
      // user pinned, and for one that has never been assigned.
      if (credential.proxyUrl && !credential.proxyAuto) continue;
      if (credential.proxyUrl === target.proxyUrl) continue;
      this.credentials.setAutoProxyUrl(credential.id, target.proxyUrl);
      changed += 1;
    }

    if (changed > 0) {
      this.events.emit({
        type: "credential.updated",
        level: "info",
        message: `${changed} credential(s) moved to a new egress IP`,
        data: { changed, poolSize },
      });
    }
    return changed;
  }

  listProxyPool(): ProxyPoolView[] {
    return this.proxyPool.view(this.credentialRefs(), this.settings.autoProxyStrategy);
  }

  proxyPoolStatus(): ProxyPoolStatus {
    return this.proxyPool.status(
      this.credentialRefs(),
      this.settings.autoProxy,
      this.settings.autoProxyStrategy,
    );
  }

  /**
   * Resolve the exit IP a probe or test request should leave through.
   *
   * Mirrors `syncProxyAssignments`, but on a transient credential that has not
   * been persisted yet: an explicit `proxyUrl` wins, then the pool slot this
   * key would land on (when the pool is enabled and has entries), otherwise
   * nothing - meaning the request goes direct. The probe stays direct when the
   * caller opted out with `useProxy: false`.
   */
  private resolveProbeProxy(credential: Credential, useProxy: boolean): string | undefined {
    if (credential.proxyUrl) return credential.proxyUrl;
    if (!useProxy || !this.settings.autoProxy) return undefined;
    if (this.proxyPool.size() === 0) return undefined;

    const [slot] = this.proxyPool.plan(
      [{ id: credential.id, providerId: credential.providerId }],
      this.settings.autoProxyStrategy,
    );
    return slot?.proxyUrl;
  }

  /** Add one proxy to the pool and re-plan immediately. */
  addProxyToPool(url: string): ProxyPoolView[] {
    this.proxyPool.add(url);
    this.syncProxyAssignments();
    return this.listProxyPool();
  }

  /** Add many proxies from one pasted blob, then re-plan once. */
  addProxiesToPool(rawList: string): { added: number; skipped: number; entries: ProxyPoolView[] } {
    const result = this.proxyPool.addMany(rawList);
    this.syncProxyAssignments();
    return { ...result, entries: this.listProxyPool() };
  }

  /**
   * Fetch Proxifly's free public list and fold it into the egress pool.
   *
   * The list is a static CDN-hosted file, so there is no API key involved and
   * nothing to be charged. `limit` caps how many entries a single click can
   * add (the file is ~60 KB today). The pool is re-planned afterwards so any
   * pool-owned credentials land on their new exits immediately.
   *
   * By default every candidate is probed first and only working exits are
   * imported: free lists die fast, and importing 2,400 addresses where only a
   * handful answer just fills the pool with timeouts. Pass `verify: false` to
   * go back to importing the whole file untouched.
   */
  async addProxiflyFreeList(
    limit?: number,
    options: { verify?: boolean; concurrency?: number; timeoutMs?: number } = {},
  ): Promise<{
    added: number;
    skipped: number;
    checked?: number;
    alive?: number;
    dead?: number;
    entries: ProxyPoolView[];
    status: ProxyPoolStatus;
  }> {
    const raw = await fetchProxiflyFreeList();

    if (options.verify !== false) {
      // Probe candidates first; only working exits land in the pool. Parse a
      // wider net than the target so enough live ones can be found, then stop
      // probing once the cap is reached instead of timing out on every corpse.
      const target = limit ?? 100;
      const candidateCap = Math.min(2_000, Math.max(target * 10, 200));
      const { urls } = parseProxiflyList(raw, candidateCap);
      const { healthy, checked } = await collectHealthy(urls, {
        limit: target,
        concurrency: options.concurrency,
        timeoutMs: options.timeoutMs,
      });

      const result = this.proxyPool.addMany(healthy.join("\n"));
      this.syncProxyAssignments();

      return {
        added: result.added,
        skipped: result.skipped,
        checked,
        alive: healthy.length,
        dead: checked - healthy.length,
        entries: this.listProxyPool(),
        status: this.proxyPoolStatus(),
      };
    }

    const { urls } = parseProxiflyList(raw, limit);
    if (urls.length === 0) {
      return {
        added: 0,
        skipped: 0,
        entries: this.listProxyPool(),
        status: this.proxyPoolStatus(),
      };
    }

    const result = this.proxyPool.addMany(urls.join("\n"));
    this.syncProxyAssignments();

    return {
      ...result,
      entries: this.listProxyPool(),
      status: this.proxyPoolStatus(),
    };
  }

  /**
   * Probe every enabled pool exit and drop the ones that no longer answer.
   *
   * Sweeping the pool periodically is the cheapest way to keep it honest: free
   * proxies open and die on a schedule, and a stale exit just turns valid keys
   * into timeouts. `prune: false` reports without deleting, so a caller can
   * preview a sweep before committing to it.
   */
  async verifyProxyPool(
    options: {
      concurrency?: number;
      timeoutMs?: number;
      prune?: boolean;
    } = {},
  ): Promise<{
    checked: number;
    healthy: number;
    dead: string[];
    removed: number;
    entries: ProxyPoolView[];
    status: ProxyPoolStatus;
  }> {
    const summary = await this.proxyPool.verify(
      (url) => checkProxyUrl(url, { timeoutMs: options.timeoutMs }),
      { concurrency: options.concurrency, prune: options.prune ?? true },
    );
    this.syncProxyAssignments();
    return {
      ...summary,
      entries: this.listProxyPool(),
      status: this.proxyPoolStatus(),
    };
  }

  removeProxyFromPool(id: string): ProxyPoolView[] {
    this.proxyPool.remove(id);
    this.syncProxyAssignments();
    return this.listProxyPool();
  }

  /**
   * Pin a credential to a specific pool entry, or hand it back to the pool.
   *
   * The browser only ever sees a pool entry's `host:port` label, never the
   * proxy's own credentials, so the UI assigns by entry id and the URL is
   * resolved here on the server. A pinned key is marked manual, which is what
   * tells `syncProxyAssignments` to leave it alone from now on; passing `null`
   * clears the pin and immediately re-runs the pool so the key lands on an exit
   * again.
   */
  assignCredentialProxy(credentialId: string, poolId: string | null): PublicCredential {
    if (poolId === null) {
      this.setCredentialProxy(credentialId, null);
      this.syncProxyAssignments();
      return this.credentials.toPublic(this.credentials.getOrThrow(credentialId));
    }

    const entry = this.proxyPool.find(poolId);
    if (!entry) throw new InvalidSettingError("No such egress pool entry");
    if (entry.enabled !== 1) throw new InvalidSettingError("That egress pool entry is disabled");

    return this.setCredentialProxy(credentialId, entry.url);
  }

  setProxyPoolEnabled(id: string, enabled: boolean): ProxyPoolView[] {
    this.proxyPool.setEnabled(id, enabled);
    this.syncProxyAssignments();
    return this.listProxyPool();
  }

  private credentialRefs(): Array<{ id: string; providerId: string }> {
    return this.credentials
      .listAll()
      .map((credential) => ({ id: credential.id, providerId: credential.providerId }));
  }

  // ---- model probe ---------------------------------------------------------

  /**
   * Prove one provider/model pair works right now, through one real request.
   *
   * This is what the catalog's play button calls. A 200 means the model and the
   * key agree; anything else is returned verbatim so the UI can say why rather
   * than showing a generic failure.
   */
  async probeModel(
    providerId: string,
    model: string,
    credentialId?: string,
    message: string = PROBE_MESSAGE,
  ): Promise<ModelProbeResult> {
    const catalog = this.providers.findCatalogEntry(providerId);
    if (!catalog) {
      return {
        ok: false,
        providerId,
        model,
        latencyMs: 0,
        classification: "unknown",
        message: `Unknown provider: ${providerId}`,
      };
    }

    const bound = this.credentials.listAll().filter((item) => item.providerId === providerId);
    if (bound.length === 0) {
      return {
        ok: false,
        providerId,
        model,
        latencyMs: 0,
        classification: "unknown",
        message: `${catalog.displayName} has no connected key`,
      };
    }

    const credential = selectProbeCredential(bound, credentialId);
    if (!credential) {
      return {
        ok: false,
        providerId,
        model,
        latencyMs: 0,
        classification: "unknown",
        message: "No usable key for this provider",
      };
    }

    const adapter = this.providers.get(providerId);
    const entry = probeEntry(providerId, model, catalog.baseUrl);
    const started = Date.now();

    let status: number | undefined;
    let reply: string | undefined;

    try {
      const result = await adapter.send(entry, credential, {
        model,
        messages: [{ role: "user", content: message }],
        max_tokens: 16,
        stream: false,
      });

      const latencyMs = Date.now() - started;

      if (!result.ok) {
        const classification = adapter.classifyError(result.error);
        status = result.error.status;
        this.recordProbeFailure(credential.id, classification);
        this.recordModelProbe(providerId, model, credential.id, false, classification, latencyMs);
        return {
          ok: false,
          providerId,
          model,
          credentialId: credential.id,
          credentialDescription: credential.description,
          status,
          latencyMs,
          classification,
          message: result.error.message,
          proxyLabel: proxyLabel(credential.proxyUrl),
        };
      }

      status = result.response.status;
      if (status !== 200) {
        const classification = adapter.classifyError({ status, message: `HTTP ${status}` });
        this.recordProbeFailure(credential.id, classification);
        this.recordModelProbe(providerId, model, credential.id, false, classification, latencyMs);
        return {
          ok: false,
          providerId,
          model,
          credentialId: credential.id,
          credentialDescription: credential.description,
          status,
          latencyMs,
          classification,
          message: `${catalog.displayName} answered ${status}`,
          proxyLabel: proxyLabel(credential.proxyUrl),
        };
      }

      try {
        const body = (await result.response.json()) as {
          choices?: Array<{ message?: { content?: unknown } }>;
        };
        const content = body.choices?.[0]?.message?.content;
        if (typeof content === "string") reply = content.slice(0, 200);
      } catch {
        // A 200 with a body we cannot parse is still a working model.
      }

      this.credentials.markVerified(credential.id);
      this.events.emit({
        type: "credential.verified",
        level: "success",
        message: `${model} answered through ${credential.description}`,
        providerId,
        model,
        credentialId: credential.id,
        credentialDescription: credential.description,
        status,
        proxyLabel: proxyLabel(credential.proxyUrl),
        data: { latencyMs, probe: true },
      });
      this.recordModelProbe(providerId, model, credential.id, true, "success", latencyMs);

      return {
        ok: true,
        providerId,
        model,
        credentialId: credential.id,
        credentialDescription: credential.description,
        status,
        latencyMs,
        classification: "success",
        reply,
        proxyLabel: proxyLabel(credential.proxyUrl),
      };
    } catch (error) {
      const latencyMs = Date.now() - started;
      this.recordModelProbe(providerId, model, credential.id, false, "network_error", latencyMs);
      return {
        ok: false,
        providerId,
        model,
        credentialId: credential.id,
        credentialDescription: credential.description,
        status,
        latencyMs,
        classification: "network_error",
        message: (error as Error).message,
        proxyLabel: proxyLabel(credential.proxyUrl),
      };
    }
  }

  private recordProbeFailure(credentialId: string, classification: ErrorClassification): void {
    if (classification === "credential_invalid") {
      this.credentials.markInvalid(credentialId);
    } else if (
      classification === "credential_rate_limited" ||
      classification === "quota_exhausted"
    ) {
      this.credentials.putInCooldown(credentialId);
    }
  }

  /** Log one play-button attempt so "My models" can rank on what actually happened. */
  private recordModelProbe(
    providerId: string,
    model: string,
    credentialId: string,
    ok: boolean,
    classification: string,
    latencyMs: number,
  ): void {
    this.modelProbesRepo.record({
      providerId,
      model,
      credentialId,
      ok,
      classification,
      latencyMs,
      checkedAt: Date.now(),
    });
  }

  /**
   * The user's own models, ranked by their own probe history.
   *
   * Scoped to models the user can actually use right now (their provider has
   * a healthy key), which is what makes this a *usable* ranking rather than a
   * curated opinion: a model with a five-star community verdict is worth
   * nothing here if this user's key cannot reach it. Within that scope, a
   * model that has answered every time it was asked, quickly, outranks one
   * that has not — and a model never probed sorts last, clearly marked, since
   * there is nothing yet to rank it on.
   */
  myModelRankings(): MyModelRanking[] {
    const statsByKey = new Map(
      this.modelProbesRepo.allStats().map((stats) => [`${stats.providerId} ${stats.model}`, stats]),
    );

    const rankings: MyModelRanking[] = [];
    for (const provider of this.modelCatalog()) {
      if (!provider.available) continue;
      for (const model of provider.models) {
        if (!model.selectable) continue;
        const stats = statsByKey.get(`${provider.providerId} ${model.id}`);
        rankings.push({
          providerId: provider.providerId,
          displayName: provider.displayName,
          model: model.id,
          attempts: stats?.attempts ?? 0,
          successes: stats?.successes ?? 0,
          successRate: stats?.successRate,
          avgLatencyMs: stats?.avgLatencyMs,
          lastCheckedAt: stats?.lastCheckedAt,
          lastOk: stats?.lastOk,
        });
      }
    }

    // Tested models first — best success rate, then fastest, ties broken by
    // most recently checked. Untested models keep catalog order at the tail.
    return rankings.sort((a, b) => {
      const aTested = a.attempts > 0;
      const bTested = b.attempts > 0;
      if (aTested !== bTested) return aTested ? -1 : 1;
      if (!aTested) return 0;
      if (b.successRate! !== a.successRate!) return b.successRate! - a.successRate!;
      const aLatency = a.avgLatencyMs ?? Number.POSITIVE_INFINITY;
      const bLatency = b.avgLatencyMs ?? Number.POSITIVE_INFINITY;
      if (aLatency !== bLatency) return aLatency - bLatency;
      return (b.lastCheckedAt ?? 0) - (a.lastCheckedAt ?? 0);
    });
  }

  /** The live status payload: current route plus recent routing events. */
  liveStatus(limit = 30): {
    route: ReturnType<EventBus["routeSnapshot"]>;
    recent: CokeyEvent[];
    subscribers: number;
  } {
    return {
      route: this.events.routeSnapshot(),
      recent: this.events.recent(limit),
      subscribers: this.events.subscriberCount,
    };
  }

  /**
   * Every curated free model, annotated with whether the user can actually use
   * it right now.
   *
   * A model is only selectable once its provider has at least one working key;
   * showing the rest greyed out is what makes the catalog honest rather than a
   * wish list.
   */
  modelCatalog(): ModelCatalogView[] {
    const counts = new Map<string, { total: number; healthy: number }>();
    const working = new Map<string, string[]>();
    const inventory = this.inventoryByProvider();
    for (const credential of this.credentials.listAll()) {
      // Fold a collapsed id onto the entry that survived deduplication, so a
      // key connected as `aion-labs` still makes `aion` usable.
      const providerId = PROVIDER_ALIASES.get(credential.providerId) ?? credential.providerId;

      if (credential.status === "healthy") {
        working.set(providerId, [...(working.get(providerId) ?? []), credential.id]);
      }
      const count = counts.get(providerId) ?? { total: 0, healthy: 0 };
      count.total += 1;
      if (credential.status === "healthy") count.healthy += 1;
      counts.set(providerId, count);
    }
    return modelAvailability(this.providers.getBuiltInCatalog(), counts, working, inventory);
  }

  /**
   * The observed model inventory for one provider, curated models annotated.
   *
   * Powers the provider detail view: what COKEY believed, what the provider last
   * said, and which of the two disagrees.
   */
  providerModelInventory(providerId: string): {
    providerId: string;
    displayName: string;
    checkedAt?: number;
    models: ProviderModelRecord[];
  } {
    const catalog = this.providers.findCatalogEntry(providerId);
    return {
      providerId,
      displayName: catalog?.displayName ?? providerId,
      checkedAt: this.providerModelsRepo.lastCheckedAt(providerId),
      models: this.providerModelsRepo.listByProvider(providerId),
    };
  }

  /**
   * What the user should do next, ordered by how much it matters.
   *
   * This method only assembles a snapshot of live state; the judgement about
   * which conditions are worth interrupting someone for lives in the pure rules
   * in `guidance.ts`. Keeping the query and the policy apart is what makes the
   * thresholds testable — and there are a lot of thresholds.
   */
  guidance(): {
    notices: GuidanceNotice[];
    summary: Record<GuidanceSeverity, number>;
    checkedAt: number;
  } {
    const notices = deriveGuidance(this.guidanceInput());
    return { notices, summary: guidanceSummary(notices), checkedAt: Date.now() };
  }

  /** Flatten the gateway's state into the plain shape the guidance rules read. */
  private guidanceInput(): GuidanceInput {
    const now = Date.now();
    const statuses = this.providerStatuses();
    const displayName = new Map(statuses.map((status) => [status.id, status.displayName]));
    const inventory = this.inventoryByProvider();

    const providers = statuses.map((status) => {
      const observed = inventory.get(status.id) ?? [];
      const curated = this.providers.findCatalogEntry(status.id)?.knownModels ?? [];
      const stale = staleCuratedModels(curated, observed);
      return {
        id: status.id,
        displayName: status.displayName,
        connected: status.connected,
        credentialCount: status.credentialCount,
        healthyCount: status.healthyCount,
        inventoryCheckedAt: this.providerModelsRepo.lastCheckedAt(status.id),
        staleModels: stale,
        modelCount:
          curated.length -
          stale.length +
          observed.filter((r) => r.available && !curated.includes(r.model)).length,
      };
    });

    const credentials = this.credentials.listAll().map((credential) => ({
      id: credential.id,
      providerId: credential.providerId,
      providerName: displayName.get(credential.providerId) ?? credential.providerId,
      description: credential.description,
      status: credential.status,
      cooldownUntil: credential.cooldownUntil,
      consecutiveFailures: credential.consecutiveFailures,
      lastVerifiedAt: credential.lastVerifiedAt,
      proxyAuto: credential.proxyAuto ?? false,
    }));

    const chains = this.chains.listChains().map((chain) => ({
      id: chain.id,
      alias: chain.alias,
      enabled: chain.enabled,
      entries: this.chains.listEntries(chain.id).map((entry) => {
        const bound = this.credentials.listByIds(entry.credentialIds);
        return {
          id: entry.id,
          providerId: entry.providerId,
          providerName: displayName.get(entry.providerId) ?? entry.providerId,
          model: entry.model,
          label: entry.label,
          enabled: entry.enabled,
          credentialCount: bound.length,
          healthyCount: bound.filter((credential) => credential.status === "healthy").length,
        };
      }),
    }));

    const pool = this.proxyPoolStatus();
    const coverage = this.freeProviderNudge();

    return {
      now,
      chains,
      credentials,
      providers,
      egress: {
        enabled: pool.enabled,
        poolSize: pool.size,
        saturatedProviders: pool.saturatedProviders.map((id) => displayName.get(id) ?? id),
      },
      coverage: {
        connectedFree: coverage.connectedFree,
        target: coverage.target,
        suggestions: coverage.suggestions.map((entry) => ({
          id: entry.id,
          displayName: entry.displayName,
        })),
      },
      content: this.guidanceContent(),
    };
  }

  /**
   * The content repository's own health, for the guidance rules.
   *
   * Read from the snapshot rather than the filesystem: the store already did the
   * reading and already knows what Failed, so asking again would be a second
   * answer to a question that has one.
   */
  private guidanceContent(): GuidanceInput["content"] {
    const snapshot = this.cms.current;
    const cutoff = Date.now() - CONTENT_FRESHNESS_DAYS * 24 * 60 * 60 * 1000;

    const staleDossiers: string[] = [];
    for (const provider of snapshot.providers.values()) {
      // A dossier with no date is treated as stale: an undated claim is exactly
      // the kind of entry that goes quietly wrong.
      const reviewed = provider.reviewedAt ? Date.parse(`${provider.reviewedAt}T00:00:00Z`) : NaN;
      if (!Number.isFinite(reviewed) || reviewed < cutoff) staleDossiers.push(provider.id);
    }

    return {
      available: snapshot.providers.size > 0,
      issues: snapshot.issues,
      staleDossiers: staleDossiers.sort(),
      unsupported: this.undocumentedProviders(),
    };
  }

  // ---- chains -------------------------------------------------------------

  /**
   * Programmatic chain creation, mirroring the UI flow: every credential is
   * verified before the entry that references it is persisted.
   */
  async addChain(input: AddChainInput): Promise<{ chainId: string; entryIds: string[] }> {
    const existing = this.chains.getChainByAlias(input.alias);
    const chain =
      existing ?? this.chains.createChain({ alias: input.alias, description: input.description });

    const entryIds: string[] = [];
    const createdCredentials: string[] = [];

    try {
      for (const entryInput of input.entries) {
        const catalog = this.providers.findCatalogEntry(entryInput.provider);
        if (!catalog) throw new Error(`Unknown provider: ${entryInput.provider}`);
        if (!catalog.knownModels.includes(entryInput.model)) {
          throw new Error(
            `Model "${entryInput.model}" is not in the ${catalog.displayName} catalog`,
          );
        }

        const credentialIds: string[] = [];

        for (const credentialInput of entryInput.credentials) {
          const secret = credentialInput.secret ?? readEnvSecret(credentialInput.env);
          if (!secret) {
            throw new Error(
              `No secret supplied for "${credentialInput.description}"` +
                (credentialInput.env
                  ? ` (environment variable ${credentialInput.env} is unset)`
                  : ""),
            );
          }

          const credential = this.credentials.create({
            providerId: entryInput.provider,
            accountId: credentialInput.accountId,
            secret,
            description: credentialInput.description,
          });
          createdCredentials.push(credential.id);

          const validation = await this.verifyCredential(
            entryInput.provider,
            entryInput.model,
            credential,
          );

          if (validation.ok) {
            this.credentials.markVerified(credential.id);
            credentialIds.push(credential.id);
            continue;
          }

          if (
            validation.classification === "credential_rate_limited" ||
            validation.classification === "quota_exhausted"
          ) {
            this.credentials.putInCooldown(credential.id);
            credentialIds.push(credential.id);
            continue;
          }

          if (validation.classification === "network_error" && credentialInput.addAnyway) {
            credentialIds.push(credential.id);
            continue;
          }

          if (validation.classification === "model_unavailable") {
            throw new BadCredentialError(
              `Model ${entryInput.model} is not available on this key`,
              validation.classification,
            );
          }

          throw new BadCredentialError(
            validation.message ?? `${entryInput.provider} rejected this key`,
            validation.classification,
          );
        }

        const entry = this.chains.addEntry({
          chainId: chain.id,
          providerId: entryInput.provider,
          model: entryInput.model,
          baseUrl: catalog.baseUrl,
          credentialIds,
          routingStrategy: entryInput.routingStrategy,
        });
        entryIds.push(entry.id);
      }
    } catch (error) {
      // Roll back this call's side effects so a failed add leaves no residue.
      for (const id of createdCredentials) {
        this.chains.detachCredentialEverywhere(id);
        this.credentials.delete(id);
      }
      throw error;
    }

    return { chainId: chain.id, entryIds };
  }

  /**
   * Verify a credential specifically for the model it will serve.
   *
   * Providers that validate per model get a one-token ping against the chosen
   * model; the rest are checked with a model listing, which is cheaper.
   */
  async verifyCredential(
    providerId: string,
    model: string,
    credential: Credential,
    useProxy = true,
  ): Promise<ValidationResult> {
    const catalog = this.providers.findCatalogEntry(providerId);
    const adapter = this.providers.get(providerId);

    // Probe leaves through the exit this key would get in production. The pool
    // reassignment happens after connect, so it cannot be relied on here.
    const exit = this.resolveProbeProxy(credential, useProxy);
    const probeCredential = exit !== undefined ? { ...credential, proxyUrl: exit } : credential;

    // Always try a real chat request against the specific model so that
    // quota exhaustion and model availability are both tested.
    if (catalog) {
      const started = Date.now();
      const now = Date.now();
      const probe: ChainEntry = {
        id: "probe",
        chainId: "probe",
        providerId,
        model,
        baseUrl: catalog.baseUrl,
        credentialIds: [],
        enabled: true,
        priority: 0,
        routingStrategy: "sequential",
        createdAt: now,
        updatedAt: now,
      };

      const result = await adapter.send(probe, probeCredential, {
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      });

      const latencyMs = Date.now() - started;
      if (result.ok) return { ok: true, classification: "success", latencyMs };

      return {
        ok: false,
        classification: adapter.classifyError(result.error),
        message: result.error.message,
        latencyMs,
      };
    }

    return adapter.validateCredential(probeCredential);
  }

  listChains(): ChainView[] {
    return this.chains.listChains().map((chain) => ({
      ...chain,
      entries: this.chains.listEntries(chain.id).map((entry) => this.entryView(entry)),
    }));
  }

  entryView(entry: ChainEntry): ChainEntryView {
    const credentials = this.credentials
      .listByIds(entry.credentialIds)
      .map((credential) => this.credentials.toPublic(credential));
    return {
      ...entry,
      credentials,
      healthyCount: credentials.filter((c) => c.status === "healthy").length,
      cooldownCount: credentials.filter((c) => c.status === "cooldown").length,
      provider: this.providers.findCatalogEntry(entry.providerId),
    };
  }

  // ---- routing ------------------------------------------------------------

  route(chainAlias: string, request: ChatCompletionRequest): Promise<RouteResult> {
    return this.router.route(chainAlias, request);
  }

  /** Chain aliases plus every model reachable through an enabled entry. */
  listModelIds(): string[] {
    const ids = new Set<string>();
    for (const chain of this.chains.listChains()) {
      if (!chain.enabled) continue;
      ids.add(chain.alias);
      for (const entry of this.chains.listEnabledEntries(chain.id)) {
        if (entry.enabled) ids.add(entry.model);
      }
    }
    return [...ids].sort();
  }

  // ---- custom endpoints ---------------------------------------------------

  addCustomEndpoint(input: CustomEndpointInput) {
    const guard = assertSafeEndpoint(input.baseUrl, {
      allowPrivate: this.settings.allowPrivateEndpoints,
    });

    const id = randomUUID().replace(/-/g, "").slice(0, 12);
    const now = Date.now();
    this.customEndpointsRepo.insert({
      id,
      displayName: input.displayName,
      baseUrl: guard.toString().replace(/\/+$/, ""),
      apiStyle: ApiStyleSchema.parse(input.apiStyle),
      authScheme: AuthSchemeSchema.parse(input.authScheme),
      models: JSON.stringify(input.models ?? []),
      createdAt: now,
      updatedAt: now,
    });

    this.providers.syncCustomEndpoints(this.customEndpointsRepo.list());
    const entry = this.providers.findCatalogEntry(`custom:${id}`);
    if (!entry) throw new Error("Failed to register custom endpoint");
    return entry;
  }

  listCustomEndpoints(): ProviderCatalogEntry[] {
    return this.providers.getCatalog().filter((entry) => entry.id.startsWith("custom:"));
  }

  deleteCustomEndpoint(providerId: string): void {
    const id = providerId.replace(/^custom:/, "");
    this.customEndpointsRepo.delete(id);
    this.providers.syncCustomEndpoints(this.customEndpointsRepo.list());
  }

  // ---- reporting ----------------------------------------------------------

  /**
   * Usage view: per provider → per key → per model, plus the live route.
   *
   * Token counts come from the per-day rollup; remaining quota comes from the
   * last provider response (may be absent - never invented). `now` is the route
   * the router is on, so the UI can show which node/sub-key is serving.
   */
  usageView(): {
    now: ReturnType<EventBus["routeSnapshot"]>;
    today: string;
    providers: Array<{
      providerId: string;
      displayName: string;
      credentials: PublicCredential[];
      models: Array<{
        model: string;
        requests: number;
        success: number;
        failure: number;
        inputTokens: number;
        outputTokens: number;
        averageLatencyMs: number;
        perCredential: Array<{
          credentialId: string;
          requests: number;
          inputTokens: number;
          outputTokens: number;
        }>;
      }>;
      daily: Array<{ day: string; requests: number; inputTokens: number; outputTokens: number }>;
    }>;
    chains: Array<{
      id: string;
      alias: string;
      enabled: boolean;
      entries: Array<{
        id: string;
        providerId: string;
        model: string;
        enabled: boolean;
        priority: number;
        routingStrategy: RoutingStrategy;
        credentials: Array<{ id: string; description: string; status: string; active: boolean }>;
      }>;
    }>;
  } {
    const now = this.events.routeSnapshot();
    const today = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
    const rows = this.history.rollup(since);

    const catalog = new Map(
      this.providers.getCatalog().map((entry) => [entry.id, entry.displayName]),
    );
    const byProvider = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byProvider.get(row.provider_id) ?? [];
      list.push(row);
      byProvider.set(row.provider_id, list);
    }

    const credentials = this.credentials.listAll();
    const providerIds = new Set<string>([
      ...credentials.map((credential) => credential.providerId),
      ...byProvider.keys(),
    ]);

    const providers = [...providerIds].map((providerId) => {
      const providerRows = byProvider.get(providerId) ?? [];
      const modelNames = [...new Set(providerRows.map((row) => row.model))].sort();

      const models = modelNames.map((model) => {
        const modelRows = providerRows.filter((row) => row.model === model);
        const perCredentialMap = new Map<
          string,
          { credentialId: string; requests: number; inputTokens: number; outputTokens: number }
        >();
        let requests = 0;
        let success = 0;
        let failure = 0;
        let inputTokens = 0;
        let outputTokens = 0;
        let latencySum = 0;
        for (const row of modelRows) {
          requests += row.requests;
          success += row.success;
          failure += row.failure;
          inputTokens += row.input_tokens;
          outputTokens += row.output_tokens;
          latencySum += row.latency_ms_sum;
          const existing = perCredentialMap.get(row.credential_id) ?? {
            credentialId: row.credential_id,
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
          };
          existing.requests += row.requests;
          existing.inputTokens += row.input_tokens;
          existing.outputTokens += row.output_tokens;
          perCredentialMap.set(row.credential_id, existing);
        }
        return {
          model,
          requests,
          success,
          failure,
          inputTokens,
          outputTokens,
          averageLatencyMs: requests === 0 ? 0 : Math.round(latencySum / requests),
          perCredential: [...perCredentialMap.values()],
        };
      });

      const days = [...new Set(providerRows.map((row) => row.day))].sort((a, b) =>
        a < b ? 1 : -1,
      );
      const daily = days.map((day) => {
        const dayRows = providerRows.filter((row) => row.day === day);
        return {
          day,
          requests: dayRows.reduce((sum, row) => sum + row.requests, 0),
          inputTokens: dayRows.reduce((sum, row) => sum + row.input_tokens, 0),
          outputTokens: dayRows.reduce((sum, row) => sum + row.output_tokens, 0),
        };
      });

      return {
        providerId,
        displayName: catalog.get(providerId) ?? providerId,
        credentials: credentials
          .filter((credential) => credential.providerId === providerId)
          .map((credential) => this.credentials.toPublic(credential)),
        models,
        daily,
      };
    });

    providers.sort((a, b) => a.displayName.localeCompare(b.displayName));

    const chains = this.chains.listChains().map((chain) => ({
      id: chain.id,
      alias: chain.alias,
      enabled: chain.enabled,
      entries: this.chains.listEntries(chain.id).map((entry) => ({
        id: entry.id,
        providerId: entry.providerId,
        model: entry.model,
        enabled: entry.enabled,
        priority: entry.priority,
        routingStrategy: entry.routingStrategy,
        credentials: this.credentials.listByIds(entry.credentialIds).map((credential) => ({
          id: credential.id,
          description: credential.description,
          status: credential.status,
          active: now.active && now.credentialId === credential.id,
        })),
      })),
    }));

    return { now, today, providers, chains };
  }

  stats(): {
    chains: number;
    credentials: number;
    healthyCredentials: number;
    cooldownCredentials: number;
    invalidCredentials: number;
    providersConnected: number;
    customEndpoints: number;
    history: HistoryStats;
    dataDir: string;
    keySource: string;
  } {
    const credentials = this.credentials.listAll();
    return {
      chains: this.chains.listChains().length,
      credentials: credentials.length,
      healthyCredentials: credentials.filter((c) => c.status === "healthy").length,
      cooldownCredentials: credentials.filter((c) => c.status === "cooldown").length,
      invalidCredentials: credentials.filter((c) => c.status === "invalid").length,
      providersConnected: this.credentials.countsByProvider().size,
      customEndpoints: this.customEndpointsRepo.count(),
      history: this.history.stats(),
      dataDir: this.dataDir,
      keySource: this.vault.keyKind,
    };
  }

  /** The local "incite" check: how many advertised-free providers are connected,
   *  and which ones would widen failover coverage.
   *
   * Entirely local - there is no telemetry behind this.
   */
  freeProviderNudge(): FreeProviderNudge {
    const counts = this.credentials.countsByProvider();
    const free = this.providers.getCatalog().filter((entry) => entry.freeTier.advertised);
    const connected = free.filter((entry) => (counts.get(entry.id)?.total ?? 0) > 0);

    return {
      connectedFree: connected.length,
      target: this.settings.freeProviderTarget,
      suggestions: free.filter((entry) => !connected.includes(entry)),
    };
  }

  // ---- management auth ------------------------------------------------------

  verifyPassword(password: string): boolean {
    return this.settingsService.verifyPassword(password);
  }

  passwordLocked(): boolean {
    return this.settingsService.passwordLocked();
  }

  setPassword(password: string): void {
    this.settingsService.setPassword(password);
  }

  createApiKey(name: string): CreatedApiKey {
    return this.apiKeys.create(name);
  }

  listApiKeys(): ApiKeyView[] {
    return this.apiKeys.list();
  }

  revokeApiKey(id: string): void {
    this.apiKeys.revoke(id);
  }

  verifyApiKey(presented: string): ApiKeyView | undefined {
    return this.apiKeys.verify(presented);
  }
}

function readEnvSecret(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

/**
 * One line describing a model inventory change.
 *
 * Written to name the provider first, because the notification appears in a bar
 * that may be showing a dozen other providers' news, and "3 models added" is
 * useless without knowing whose.
 */
function describeModelChange(
  displayName: string,
  changes: { added: string[]; restored: string[]; removed: string[] },
): string {
  const parts: string[] = [];
  if (changes.added.length > 0) parts.push(`${changes.added.length} new`);
  if (changes.restored.length > 0) parts.push(`${changes.restored.length} back`);
  if (changes.removed.length > 0) parts.push(`${changes.removed.length} retired`);
  return `${displayName}: ${parts.join(", ")} model(s)`;
}
