import { ProxyPool } from "./pool.js";
import type { ProxyPoolAddress } from "./pool.js";
import { parseProxyUrl } from "./proxy.js";

export interface ProviderProxyConfig {
  source:
    | { kind: "off" }
    | { kind: "credential"; seedUrl: string }
    | { kind: "shared"; pool: ProxyPool };
}

export interface ProviderProxyState {
  config: ProviderProxyConfig;
  nextLabel?: string;
  lastAddress?: ProxyPoolAddress;
}

const EMPTY: ProviderProxyState = {
  config: { source: { kind: "off" } },
  nextLabel: undefined,
  lastAddress: undefined,
};

export class ProviderProxy {
  private readonly pools = new Map<string, ProxyPool>();
  private readonly byProvider = new Map<string, ProviderProxyState>();

  constructor() {
    this.byProvider.set("__default__", EMPTY);
  }

  seedProvider(providerId: string, url: string): void {
    const pool = this.poolFor(providerId);
    pool.replace([url]);
    const sharedSource: ProviderProxyConfig["source"] = { kind: "shared", pool };
    this.byProvider.set(providerId, makeState({ source: sharedSource }, pool));
  }

  seedProviderList(providerId: string, urls: string[]): void {
    const pool = this.poolFor(providerId);
    pool.replace(urls);
    const sharedSource: ProviderProxyConfig["source"] = { kind: "shared", pool };
    this.byProvider.set(providerId, makeState({ source: sharedSource }, pool));
  }

  fromCredential(providerId: string, credentialId: string, proxyUrl: string): void {
    const parsed = parseProxyUrl(proxyUrl);
    if (!parsed) return;
    const pool = this.poolFor(providerId);
    pool.replace([parsed.href]);
    const credSource: ProviderProxyConfig["source"] = {
      kind: "credential",
      seedUrl: parsed.href,
    };
    this.byProvider.set(providerId, makeState({ source: credSource }, pool));
  }

  resolve(
    providerId: string,
    credentialId: string,
    explicitProxyUrl: string | undefined,
  ): ProxyPoolAddress | undefined {
    const state = this.byProvider.get(providerId) ?? EMPTY;
    if (explicitProxyUrl) {
      const parsed = parseProxyUrl(explicitProxyUrl);
      if (!parsed) return undefined;
      state.lastAddress = { url: parsed.href, label: parsed.label };
      return state.lastAddress;
    }

    if (state.config.source.kind === "off") return undefined;
    if (state.config.source.kind === "credential") {
      const pool = this.pools.get(`${providerId}:${state.config.source.seedUrl}`);
      if (!pool) return undefined;
      const address = pool.next();
      state.lastAddress = address;
      state.nextLabel = address?.label;
      return address;
    }

    const pool =
      state.config.source.kind === "shared" ? state.config.source.pool : undefined;
    if (!pool) return undefined;
    const address = pool.next();
    state.lastAddress = address;
    state.nextLabel = address?.label;
    return address;
  }

  /** Return a dispatcher for the address the provider would use next. */
  dispatcherForNext(providerId: string): ProxyPoolAddress | undefined {
    const state = this.byProvider.get(providerId) ?? EMPTY;
    if (state.config.source.kind === "off") return undefined;
    const pool =
      state.config.source.kind === "credential"
        ? this.pools.get(`${providerId}:${state.config.source.seedUrl}`)
        : state.config.source.kind === "shared"
          ? state.config.source.pool
          : undefined;
    if (!pool) return undefined;
    const address = pool.next();
    state.lastAddress = address;
    state.nextLabel = address?.label;
    return address;
  }

  prune(providerId: string, now = Date.now()): number {
    const state = this.byProvider.get(providerId);
    if (!state || state.config.source.kind !== "shared") return 0;
    return state.config.source.pool.prune(now);
  }

  snapshot(providerId: string): ProviderProxyState {
    return this.byProvider.get(providerId) ?? EMPTY;
  }

  poolFor(providerId: string): ProxyPool {
    const key = `provider:${providerId}`;
    let pool = this.pools.get(key);
    if (!pool) {
      pool = new ProxyPool({
        source: { kind: "static", url: "" },
        idleTtlMs: 5 * 60 * 1000,
      });
      this.pools.set(key, pool);
    }
    return pool;
  }
}

function makeState(config: ProviderProxyConfig, pool?: ProxyPool): ProviderProxyState {
  const nextLabel = pool?.snapshot().addresses[0]?.label;
  return {
    config,
    nextLabel,
    lastAddress:
      nextLabel
        ? { url: pool!.snapshot().addresses[0]!.url, label: nextLabel }
        : undefined,
  };
}
