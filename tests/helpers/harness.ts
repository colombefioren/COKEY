import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ChainsRepo } from "../../src/core/db/chains.repo.js";
import { CredentialsRepo } from "../../src/core/db/credentials.repo.js";
import { DatabaseClient } from "../../src/core/db/database.js";
import { ChainManager } from "../../src/core/chains/manager.js";
import { CooldownManager } from "../../src/core/credentials/cooldown.js";
import { CredentialManager } from "../../src/core/credentials/manager.js";
import { RateTracker } from "../../src/core/credentials/rate.js";
import { CredentialSelector } from "../../src/core/credentials/selector.js";
import { SecretVault } from "../../src/core/crypto/secrets.js";
import { EventBus } from "../../src/core/events.js";
import { classifyError } from "../../src/core/errors/classify.js";
import { silentLogger } from "../../src/core/logger.js";
import type { ProviderAdapter, ProviderRequest, SendResult } from "../../src/core/providers/adapter.js";
import type { ProviderRegistry } from "../../src/core/providers/registry.js";
import { RouterEngine } from "../../src/core/router/engine.js";
import { DEFAULT_FALLBACK_POLICY, type Credential } from "../../src/core/types.js";

/** A scripted upstream answer. `status` below 300 (or absent) means success. */
export interface StubResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export type StubFn = (credential: Credential, model: string) => StubResponse;

export interface StubCall {
  credentialId: string;
  description: string;
  model: string;
  proxyUrl?: string;
}

/**
 * A provider adapter whose every answer is dictated by a test.
 *
 * It records the exact order credentials were tried, which is what the routing
 * invariant is actually about.
 */
export class StubAdapter implements ProviderAdapter {
  readonly id = "stub";
  readonly apiStyle = "openai";
  readonly calls: StubCall[] = [];

  constructor(private readonly respond: StubFn) {}

  resolveBaseUrl(): string {
    return "https://stub.test/v1";
  }

  buildHeaders(): Record<string, string> {
    return {};
  }

  createRequest(entry: { model: string }, credential: Credential): ProviderRequest {
    return {
      url: "https://stub.test/v1/chat/completions",
      method: "POST",
      headers: {},
      body: JSON.stringify({ model: entry.model }),
      stream: false,
      proxyUrl: credential.proxyUrl,
    };
  }

  async send(
    entry: { model: string },
    credential: Credential,
  ): Promise<SendResult> {
    this.calls.push({
      credentialId: credential.id,
      description: credential.description,
      model: entry.model,
      proxyUrl: credential.proxyUrl,
    });

    const stub = this.respond(credential, entry.model);
    const status = stub.status ?? 200;

    if (status >= 200 && status < 300) {
      return {
        ok: true,
        response: new Response(JSON.stringify(stub.body ?? { ok: true }), {
          status,
          headers: stub.headers ?? { "content-type": "application/json" },
        }),
      };
    }

    return {
      ok: false,
      error: {
        status,
        message: `stub ${status}`,
        body: stub.body,
        headers: stub.headers,
      },
    };
  }

  classifyError(error: { status?: number; message: string; body?: unknown }) {
    return classifyError(error);
  }

  async validateCredential() {
    return { ok: true as const, classification: "success" as const };
  }

  async listModels() {
    return [];
  }
}

/** Minimal registry: the router only ever asks for an adapter by provider id. */
export class StubRegistry {
  private readonly adapters = new Map<string, StubAdapter>();

  register(providerId: string, adapter: StubAdapter): void {
    this.adapters.set(providerId, adapter);
  }

  get(providerId: string): StubAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) throw new Error(`No stub adapter for ${providerId}`);
    return adapter;
  }
}

export interface Harness {
  dir: string;
  db: DatabaseClient;
  vault: SecretVault;
  credentials: CredentialManager;
  chains: ChainManager;
  selector: CredentialSelector;
  cooldown: CooldownManager;
  rates: RateTracker;
  events: EventBus;
  registry: StubRegistry;
  router: RouterEngine;
  cleanup(): void;
}

/** Build an isolated COKEY core around a throwaway data directory. */
export function createHarness(): Harness {
  const dir = mkdtempSync(join(tmpdir(), "cokey-test-"));
  const db = new DatabaseClient(join(dir, "cokey.db"));
  const vault = new SecretVault({ dataDir: dir, disableKeychain: true });
  const cooldown = new CooldownManager();
  const rates = new RateTracker();
  const credentials = new CredentialManager(
    new CredentialsRepo(db),
    vault,
    cooldown,
    rates,
  );
  const chains = new ChainManager(new ChainsRepo(db));
  const selector = new CredentialSelector(credentials, cooldown);
  const events = new EventBus();
  const registry = new StubRegistry();

  const router = new RouterEngine(
    chains,
    credentials,
    registry as unknown as ProviderRegistry,
    cooldown,
    selector,
    silentLogger(),
    events,
    rates,
    () => ({ ...DEFAULT_FALLBACK_POLICY, maxRetriesPerCredential: 0 }),
    { sleep: async () => {} },
  );

  return {
    dir,
    db,
    vault,
    credentials,
    chains,
    selector,
    cooldown,
    rates,
    events,
    registry,
    router,
    cleanup() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Convenience: create a credential with a readable label. */
export function addCredential(
  harness: Harness,
  providerId: string,
  description: string,
  extra: { proxyUrl?: string } = {},
): Credential {
  return harness.credentials.create({
    providerId,
    secret: `sk-test-${description.toLowerCase().replace(/\s+/g, "-")}`,
    description,
    ...extra,
  });
}
