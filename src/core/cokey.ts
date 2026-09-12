import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { ApiKeyService, type ApiKeyView, type CreatedApiKey } from "./api-keys.js";
import { ApiKeysRepo } from "./db/api-keys.repo.js";
import type { ProviderCatalogEntry, ProviderStatus } from "../catalog/types.js";
import { ApiStyleSchema, AuthSchemeSchema } from "./validation/schemas.js";
import { ChainsRepo } from "./db/chains.repo.js";
import { CredentialsRepo } from "./db/credentials.repo.js";
import { CustomEndpointsRepo } from "./db/custom-endpoints.repo.js";
import { DatabaseClient } from "./db/database.js";
import { RequestsRepo } from "./db/requests.repo.js";
import { SettingsRepo } from "./db/settings.repo.js";
import { ChainManager } from "./chains/manager.js";
import { CredentialManager } from "./credentials/manager.js";
import { CooldownManager } from "./credentials/cooldown.js";
import { RateTracker } from "./credentials/rate.js";
import { CredentialSelector } from "./credentials/selector.js";
import { EventBus, type CokeyEvent } from "./events.js";
import { parseProxyUrl, proxyLabel } from "./providers/proxy.js";
import { modelAvailability, type ModelCatalogView } from "./models/availability.js";
import { SecretVault } from "./crypto/secrets.js";
import { RequestHistory, type HistoryStats } from "./history.js";
import { Logger } from "./logger.js";
import { ProviderRegistry } from "./providers/registry.js";
import { RouterEngine, type RouteResult } from "./router/engine.js";
import { SettingsService } from "./settings.js";
import { assertSafeEndpoint } from "./security/ssrf.js";
import type {
  Chain,
  ChainEntry,
  ChatCompletionRequest,
  Credential,
  LogLevel,
  PublicCredential,
  RoutingStrategy,
  Settings,
  ValidationResult,
} from "./types.js";

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
}

export interface ConnectProviderResult {
  credential: PublicCredential;
  validation: ValidationResult;
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
 * This class owns every long-lived object — database, vault, managers, router —
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
  readonly apiKeysRepo: ApiKeysRepo;
  readonly apiKeys: ApiKeyService;

  readonly settingsService: SettingsService;
  readonly cooldown: CooldownManager;
  readonly credentials: CredentialManager;
  readonly chains: ChainManager;
  readonly providers: ProviderRegistry;
  readonly selector: CredentialSelector;
  readonly router: RouterEngine;
  readonly history: RequestHistory;
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
    this.db.close();
    this.started = false;
  }

  // ---- providers ----------------------------------------------------------

  /** Catalog entries annotated with the user's connection state. */
  providerStatuses(): ProviderStatus[] {
    const counts = this.credentials.countsByProvider();
    return this.providers.getCatalog().map((entry) => {
      const count = counts.get(entry.id);
      return {
        ...entry,
        connected: (count?.total ?? 0) > 0,
        credentialCount: count?.total ?? 0,
        healthyCount: count?.healthy ?? 0,
      };
    });
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
    });

    const adapter = this.providers.get(providerId);
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

    return {
      credential: this.credentials.toPublic(this.credentials.getOrThrow(credential.id)),
      validation,
    };
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
    } else if (
      validation.classification === "credential_rate_limited" ||
      validation.classification === "quota_exhausted"
    ) {
      this.credentials.putInCooldown(credential.id);
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
    this.credentials.updateProxyUrl(credentialId, parsed ? parsed.href : null);

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
    const counts = this.credentials.countsByProvider();
    const working = new Map<string, string[]>();
    for (const credential of this.credentials.listAll()) {
      if (credential.status !== "healthy") continue;
      const ids = working.get(credential.providerId) ?? [];
      ids.push(credential.id);
      working.set(credential.providerId, ids);
    }
    return modelAvailability(this.providers.getBuiltInCatalog(), counts, working);
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
  ): Promise<ValidationResult> {
    const catalog = this.providers.findCatalogEntry(providerId);
    const adapter = this.providers.get(providerId);

    if (!catalog || catalog.verification.method !== "chat") {
      return adapter.validateCredential(credential);
    }

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

    const result = await adapter.send(probe, credential, {
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
   * last provider response (may be absent — never invented). `now` is the route
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
   * Entirely local — there is no telemetry behind this.
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
