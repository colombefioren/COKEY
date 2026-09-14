export interface ProxyPoolConfig {
  source: ProxyPoolSource;
  idleTtlMs: number;
}

export type ProxyPoolSource =
  | { kind: "static"; url: string }
  | { kind: "file"; path: string }
  | { kind: "provider"; providerId: string; credentialId: string };

export interface ProxyPoolAddress {
  url: string;
  label: string;
  firstSeenAt?: number;
  lastUsedAt?: number;
}

export interface ProxyPoolSnapshot {
  addresses: ProxyPoolAddress[];
  nextIndex: number;
  size: number;
  explicit: boolean;
}

export class ProxyPool {
  private _addresses: ProxyPoolAddress[];
  private nextIndex = 0;
  private readonly idleTtlMs: number;
  private readonly explicit: boolean;

  constructor(config: ProxyPoolConfig) {
    this.explicit = config.source.kind === "static" || config.source.kind === "provider";
    this._addresses = config.source.kind === "static" ? [parseAddress(config.source.url)] : [];
    this.idleTtlMs = config.idleTtlMs;
  }

  get addresses(): ReadonlyArray<ProxyPoolAddress> {
    return this._addresses;
  }

  replace(raw: string[]): void {
    this._addresses = raw.map(parseAddress);
    this.nextIndex = 0;
  }

  append(line: string): void {
    try {
      this._addresses.push(parseAddress(line.trim()));
    } catch {
      // ignore malformed line
    }
  }

  next(): ProxyPoolAddress | undefined {
    if (this._addresses.length === 0) return undefined;
    const current = this._addresses[this.nextIndex % this._addresses.length];
    this.nextIndex = (this.nextIndex + 1) % this._addresses.length;
    const at = Date.now();
    current.lastUsedAt = at;
    if (current.firstSeenAt === undefined) current.firstSeenAt = at;
    return { ...current };
  }

  prune(now = Date.now()): number {
    const removed = 0;
    this._addresses = this._addresses.filter((address) => {
      if (address.lastUsedAt !== undefined && now - address.lastUsedAt <= this.idleTtlMs)
        return true;
      if (address.firstSeenAt === undefined) return true;
      return now - address.firstSeenAt <= this.idleTtlMs;
    });
    if (this._addresses.length === 0) this.nextIndex = 0;
    else if (this.nextIndex >= this._addresses.length) this.nextIndex = 0;
    return removed;
  }

  snapshot(): ProxyPoolSnapshot {
    return {
      addresses: [...this._addresses],
      nextIndex: this.nextIndex % Math.max(1, this._addresses.length),
      size: this._addresses.length,
      explicit: this.explicit,
    };
  }
}

function parseAddress(raw: string): ProxyPoolAddress {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Empty proxy address");
  const parsed = parseProxyUrl(trimmed);
  if (!parsed) throw new Error("Invalid proxy address");
  return { url: parsed.href, label: parsed.label };
}

import { parseProxyUrl } from "./proxy.js";
