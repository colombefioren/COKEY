import { randomUUID } from "node:crypto";
import type { ChainEntryRow, ChainRow } from "../db/database.js";
import type { ChainsRepo } from "../db/chains.repo.js";
import type { Chain, ChainEntry, RoutingStrategy } from "../types.js";

export class ChainNotFoundError extends Error {
  constructor(idOrAlias: string) {
    super(`Chain not found: ${idOrAlias}`);
    this.name = "ChainNotFoundError";
  }
}

export class DuplicateAliasError extends Error {
  constructor(alias: string) {
    super(`Alias already in use: ${alias}`);
    this.name = "DuplicateAliasError";
  }
}

export class InvalidAliasError extends Error {
  constructor(alias: string) {
    super(
      `Invalid alias "${alias}": use letters, digits, dot, dash or underscore, starting with a letter or digit`,
    );
    this.name = "InvalidAliasError";
  }
}

const ALIAS_RE = /^[a-z0-9][a-z0-9._-]*$/i;
const MAX_ALIAS_LENGTH = 64;

export function validateAlias(alias: string): void {
  if (!alias || alias.length > MAX_ALIAS_LENGTH || !ALIAS_RE.test(alias)) {
    throw new InvalidAliasError(alias);
  }
}

export interface CreateChainInput {
  alias: string;
  description?: string;
}

export interface AddEntryInput {
  chainId: string;
  providerId: string;
  model: string;
  /** Optional display name. Never derived from the model id automatically. */
  label?: string;
  baseUrl: string;
  credentialIds: string[];
  routingStrategy?: RoutingStrategy;
  enabled?: boolean;
  priority?: number;
}

/**
 * Owns chains and their ordered entries.
 *
 * Priority is user-owned: `reorder` rewrites it wholesale, and every read
 * returns entries already sorted by priority so callers never re-sort.
 */
export class ChainManager {
  constructor(private readonly repo: ChainsRepo) {}

  // ---- chains -------------------------------------------------------------

  createChain(input: CreateChainInput): Chain {
    validateAlias(input.alias);
    if (this.repo.getChainByAlias(input.alias)) throw new DuplicateAliasError(input.alias);

    const now = Date.now();
    const id = randomUUID();
    this.repo.insertChain({
      id,
      alias: input.alias,
      description: input.description,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    return this.getChainOrThrow(id);
  }

  getChain(id: string): Chain | undefined {
    const row = this.repo.getChain(id);
    return row ? this.chainFromRow(row) : undefined;
  }

  getChainOrThrow(id: string): Chain {
    const chain = this.getChain(id);
    if (!chain) throw new ChainNotFoundError(id);
    return chain;
  }

  getChainByAlias(alias: string): Chain | undefined {
    const row = this.repo.getChainByAlias(alias);
    return row ? this.chainFromRow(row) : undefined;
  }

  listChains(): Chain[] {
    return this.repo.listChains().map((row) => this.chainFromRow(row));
  }

  setChainEnabled(id: string, enabled: boolean): void {
    this.repo.updateChain(id, { enabled: enabled ? 1 : 0, updatedAt: Date.now() });
  }

  renameChain(id: string, alias: string): void {
    validateAlias(alias);
    const existing = this.repo.getChainByAlias(alias);
    if (existing && existing.id !== id) throw new DuplicateAliasError(alias);
    this.repo.updateChain(id, { alias, updatedAt: Date.now() });
  }

  setChainDescription(id: string, description: string | null): void {
    this.repo.updateChain(id, { description, updatedAt: Date.now() });
  }

  deleteChain(id: string): void {
    this.repo.deleteChain(id);
  }

  aliasExists(alias: string): boolean {
    return this.repo.getChainByAlias(alias) !== undefined;
  }

  // ---- entries ------------------------------------------------------------

  addEntry(input: AddEntryInput): ChainEntry {
    const chain = this.getChainOrThrow(input.chainId);
    const priority = input.priority ?? this.repo.maxPriority(chain.id) + 1;

    const id = randomUUID();
    const now = Date.now();
    this.repo.insertEntry({
      id,
      chainId: chain.id,
      providerId: input.providerId,
      model: input.model,
      label: input.label,
      baseUrl: input.baseUrl.replace(/\/$/, ""),
      credentialIds: JSON.stringify(input.credentialIds),
      enabled: input.enabled ?? true,
      priority,
      routingStrategy: input.routingStrategy ?? "sequential",
      createdAt: now,
      updatedAt: now,
    });
    return this.getEntryOrThrow(id);
  }

  getEntry(id: string): ChainEntry | undefined {
    const row = this.repo.getEntry(id);
    return row ? this.entryFromRow(row) : undefined;
  }

  getEntryOrThrow(id: string): ChainEntry {
    const entry = this.getEntry(id);
    if (!entry) throw new Error(`Chain entry not found: ${id}`);
    return entry;
  }

  listEntries(chainId: string): ChainEntry[] {
    return this.repo.listEntries(chainId).map((row) => this.entryFromRow(row));
  }

  /** Entries eligible for routing, in priority order. */
  listEnabledEntries(chainId: string): ChainEntry[] {
    return this.listEntries(chainId).filter((entry) => entry.enabled);
  }

  updateEntry(id: string, patch: Parameters<ChainsRepo["updateEntry"]>[1]): void {
    this.repo.updateEntry(id, { ...patch, updatedAt: Date.now() });
  }

  setEntryEnabled(id: string, enabled: boolean): void {
    this.repo.updateEntry(id, { enabled: enabled ? 1 : 0, updatedAt: Date.now() });
  }

  setEntryRoutingStrategy(id: string, strategy: RoutingStrategy): void {
    this.repo.updateEntry(id, { routingStrategy: strategy, updatedAt: Date.now() });
  }

  updateEntryModel(id: string, model: string, baseUrl: string): void {
    this.repo.updateEntry(id, {
      model,
      baseUrl: baseUrl.replace(/\/$/, ""),
      updatedAt: Date.now(),
    });
  }

  /**
   * Set or clear the node's display name.
   *
   * An empty string clears it, which makes clients fall back to the raw model
   * id. COKEY never invents a label such as "DeepSeek V4 Pro (xKiro)": the
   * user decides what each node is called.
   */
  updateEntryLabel(id: string, label: string | null): void {
    const trimmed = label?.trim();
    this.repo.updateEntry(id, {
      label: trimmed ? trimmed.slice(0, 120) : null,
      updatedAt: Date.now(),
    });
  }

  deleteEntry(id: string): void {
    this.repo.deleteEntry(id);
  }

  /** Copy an entry (and its credential bindings) directly below the original. */
  duplicateEntry(id: string): ChainEntry {
    const source = this.getEntryOrThrow(id);
    const siblings = this.listEntries(source.chainId);
    const index = siblings.findIndex((entry) => entry.id === id);

    const copy = this.addEntry({
      chainId: source.chainId,
      providerId: source.providerId,
      model: source.model,
      label: source.label,
      baseUrl: source.baseUrl,
      credentialIds: [...source.credentialIds],
      routingStrategy: source.routingStrategy,
      enabled: source.enabled,
      priority: siblings.length + 1,
    });

    const ordered = siblings.map((entry) => entry.id);
    ordered.splice(index + 1, 0, copy.id);
    this.reorder(source.chainId, ordered);
    return this.getEntryOrThrow(copy.id);
  }

  addCredentialToEntry(entryId: string, credentialId: string): void {
    const entry = this.getEntryOrThrow(entryId);
    if (entry.credentialIds.includes(credentialId)) return;
    this.repo.updateEntry(entryId, {
      credentialIds: JSON.stringify([...entry.credentialIds, credentialId]),
      updatedAt: Date.now(),
    });
  }

  removeCredentialFromEntry(entryId: string, credentialId: string): void {
    const entry = this.getEntry(entryId);
    if (!entry) return;
    this.repo.updateEntry(entryId, {
      credentialIds: JSON.stringify(entry.credentialIds.filter((id) => id !== credentialId)),
      updatedAt: Date.now(),
    });
  }

  /** Detach a credential from every entry of every chain. */
  detachCredentialEverywhere(credentialId: string): void {
    for (const chain of this.listChains()) {
      for (const entry of this.listEntries(chain.id)) {
        if (entry.credentialIds.includes(credentialId)) {
          this.removeCredentialFromEntry(entry.id, credentialId);
        }
      }
    }
  }

  /**
   * Rewrite the priority of every entry in a chain.
   *
   * Ids not belonging to the chain are ignored, and entries missing from
   * `orderedEntryIds` are appended so a partial ordering can never lose rows.
   */
  reorder(chainId: string, orderedEntryIds: string[]): void {
    const existing = this.listEntries(chainId);
    const valid = new Set(existing.map((entry) => entry.id));

    const filtered: string[] = [];
    for (const id of orderedEntryIds) {
      if (valid.has(id) && !filtered.includes(id)) filtered.push(id);
    }
    for (const entry of existing) {
      if (!filtered.includes(entry.id)) filtered.push(entry.id);
    }

    this.repo.reorder(chainId, filtered);
  }

  /** Move one entry to a zero-based position within its chain. */
  moveEntry(chainId: string, entryId: string, toIndex: number): void {
    const ordered = this.listEntries(chainId).map((entry) => entry.id);
    const from = ordered.indexOf(entryId);
    if (from === -1) throw new Error(`Entry ${entryId} is not in chain ${chainId}`);
    ordered.splice(from, 1);
    const target = Math.max(0, Math.min(toIndex, ordered.length));
    ordered.splice(target, 0, entryId);
    this.reorder(chainId, ordered);
  }

  countEntries(chainId: string): number {
    return this.repo.listEntries(chainId).length;
  }

  private chainFromRow(row: ChainRow): Chain {
    return {
      id: row.id,
      alias: row.alias,
      description: row.description ?? undefined,
      entryIds: this.repo.listEntries(row.id).map((entry) => entry.id),
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private entryFromRow(row: ChainEntryRow): ChainEntry {
    return {
      id: row.id,
      chainId: row.chain_id,
      providerId: row.provider_id,
      model: row.model,
      label: row.label ?? undefined,
      baseUrl: row.base_url,
      credentialIds: parseIds(row.credential_ids),
      enabled: row.enabled === 1,
      priority: row.priority,
      routingStrategy: row.routing_strategy as RoutingStrategy,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

function parseIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed.filter((v) => typeof v === "string") as string[]) : [];
  } catch {
    return [];
  }
}
