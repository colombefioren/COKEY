import { randomUUID } from "node:crypto";
import type { ProxyPoolRepo, ProxyPoolRow } from "../db/proxy-pool.repo.js";
import { mapWithConcurrency } from "./proxy-health.js";
import { parseProxyUrl } from "./proxy.js";

export interface ProxyPoolView {
  id: string;

  label: string;
  enabled: boolean;
  createdAt: number;

  assignedTo: number;
}

export interface ProxyPlanEntry {
  credentialId: string;
  providerId: string;
  proxyUrl: string;
  proxyLabel: string;

  sharedWithinProvider: boolean;
}

export interface ProxyPoolStatus {
  enabled: boolean;
  size: number;
  enabledCount: number;
  providerCount: number;
  assignments: number;

  saturatedProviders: string[];
  strategy: "per-provider" | "round-robin";
}

export interface CredentialRef {
  id: string;
  providerId: string;
}

export function providerOffset(providerId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < providerId.length; index += 1) {
    hash ^= providerId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export class ProxyPoolService {
  constructor(private readonly repo: ProxyPoolRepo) {}

  list(): ProxyPoolRow[] {
    return this.repo.list();
  }

  size(): number {
    return this.repo.count();
  }

  find(id: string): ProxyPoolRow | undefined {
    return this.repo.get(id);
  }

  entries(): Array<{ id: string; url: string; label: string; enabled: boolean }> {
    return this.repo.list().map((row) => ({
      id: row.id,
      url: row.url,
      label: row.label,
      enabled: row.enabled === 1,
    }));
  }

  add(rawUrl: string): { row: ProxyPoolRow; created: boolean } {
    const parsed = parseProxyUrl(rawUrl);
    if (!parsed) throw new Error("A proxy URL is required");

    const existing = this.repo.findByUrl(parsed.href);
    if (existing) return { row: existing, created: false };

    const row: ProxyPoolRow = {
      id: randomUUID(),
      url: parsed.href,
      label: parsed.label,
      enabled: 1,
      created_at: Date.now(),
    };
    this.repo.insert({
      id: row.id,
      url: row.url,
      label: row.label,
      enabled: true,
      createdAt: row.created_at,
    });
    return { row, created: true };
  }

  addMany(rawList: string | undefined): { added: number; skipped: number } {
    if (!rawList) return { added: 0, skipped: 0 };
    let added = 0;
    let skipped = 0;
    for (const part of rawList.split(/[\n,]+/)) {
      const value = part.trim();
      if (!value) continue;
      try {
        if (this.add(value).created) added += 1;
        else skipped += 1;
      } catch {
        skipped += 1;
      }
    }
    return { added, skipped };
  }

  setEnabled(id: string, enabled: boolean): void {
    this.repo.setEnabled(id, enabled);
  }

  remove(id: string): void {
    this.repo.delete(id);
  }

  async verify(
    probe: (url: string) => Promise<{ ok: boolean }>,
    options: { concurrency?: number; prune?: boolean } = {},
  ): Promise<{ checked: number; healthy: number; dead: string[]; removed: number }> {
    const rows = this.repo.listEnabled();
    const concurrency = options.concurrency ?? 10;
    const prune = options.prune ?? true;

    const results = await mapWithConcurrency(rows, concurrency, async (row) => {
      const verdict = await probe(row.url);
      return { row, ok: verdict.ok };
    });

    const dead: string[] = [];
    let removed = 0;
    for (const { row, ok } of results) {
      if (ok) continue;
      dead.push(row.id);
      if (prune) {
        this.repo.delete(row.id);
        removed += 1;
      }
    }

    return { checked: rows.length, healthy: rows.length - dead.length, dead, removed };
  }

  plan(
    credentials: CredentialRef[],
    strategy: "per-provider" | "round-robin" = "per-provider",
  ): ProxyPlanEntry[] {
    const pool = this.repo.listEnabled();
    if (pool.length === 0) return [];

    const byProvider = new Map<string, CredentialRef[]>();
    for (const credential of credentials) {
      const list = byProvider.get(credential.providerId) ?? [];
      list.push(credential);
      byProvider.set(credential.providerId, list);
    }

    const plan: ProxyPlanEntry[] = [];
    const providerIds = [...byProvider.keys()].sort();

    providerIds.forEach((providerId, providerIndex) => {
      const members = [...(byProvider.get(providerId) ?? [])].sort((a, b) =>
        a.id < b.id ? -1 : 1,
      );

      const base =
        strategy === "round-robin"
          ? providerIndex % pool.length
          : providerOffset(providerId) % pool.length;

      members.forEach((credential, index) => {
        const slot = (base + index) % pool.length;
        const entry = pool[slot]!;
        plan.push({
          credentialId: credential.id,
          providerId,
          proxyUrl: entry.url,
          proxyLabel: entry.label,
          sharedWithinProvider: index >= pool.length,
        });
      });
    });

    return plan;
  }

  status(
    credentials: CredentialRef[],
    enabled: boolean,
    strategy: "per-provider" | "round-robin",
  ): ProxyPoolStatus {
    const rows = this.repo.list();
    const enabledRows = rows.filter((row) => row.enabled === 1);
    const plan = this.plan(credentials, strategy);

    const counts = new Map<string, number>();
    for (const entry of plan) {
      counts.set(entry.providerId, (counts.get(entry.providerId) ?? 0) + 1);
    }
    const saturated = new Set<string>();
    for (const entry of plan) {
      if (entry.sharedWithinProvider) saturated.add(entry.providerId);
    }

    return {
      enabled,
      size: rows.length,
      enabledCount: enabledRows.length,
      providerCount: counts.size,
      assignments: plan.length,
      saturatedProviders: [...saturated].sort(),
      strategy,
    };
  }

  view(
    credentials: CredentialRef[],
    strategy: "per-provider" | "round-robin" = "per-provider",
  ): ProxyPoolView[] {
    const counts = new Map<string, number>();
    for (const entry of this.plan(credentials, strategy)) {
      counts.set(entry.proxyUrl, (counts.get(entry.proxyUrl) ?? 0) + 1);
    }
    return this.repo.list().map((row) => ({
      id: row.id,
      label: row.label,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      assignedTo: counts.get(row.url) ?? 0,
    }));
  }
}
