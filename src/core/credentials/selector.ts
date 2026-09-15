import type { ChainEntry, Credential } from "../types.js";
import type { CredentialManager } from "./manager.js";
import type { CooldownManager } from "./cooldown.js";

export class CredentialSelector {
  private readonly cursor = new Map<string, number>();
  private readonly inFlight = new Map<string, Map<string, number>>();

  constructor(
    private readonly credentials: CredentialManager,
    private readonly cooldown: CooldownManager,
  ) {}

  order(entry: ChainEntry, now = Date.now()): Credential[] {
    const bound = this.credentials.listByIds(entry.credentialIds).filter((credential) => {
      if (credential.status === "disabled" || credential.status === "invalid") return false;
      return !this.cooldown.isInCooldown(credential, now);
    });

    if (bound.length <= 1 || entry.routingStrategy === "sequential") return bound;

    const start = (this.cursor.get(entry.id) ?? 0) % bound.length;
    const rotated = [...bound.slice(start), ...bound.slice(0, start)];
    this.cursor.set(entry.id, (start + 1) % bound.length);

    const counts = this.inFlight.get(entry.id);
    if (!counts) return rotated;

    return rotated
      .map((credential, index) => ({ credential, index, load: counts.get(credential.id) ?? 0 }))
      .sort((a, b) => (a.load === b.load ? a.index - b.index : a.load - b.load))
      .map((item) => item.credential);
  }

  all(entry: ChainEntry): Credential[] {
    return this.credentials.listByIds(entry.credentialIds);
  }

  acquire(entryId: string, credentialId: string): void {
    let counts = this.inFlight.get(entryId);
    if (!counts) {
      counts = new Map();
      this.inFlight.set(entryId, counts);
    }
    counts.set(credentialId, (counts.get(credentialId) ?? 0) + 1);
  }

  release(entryId: string, credentialId: string): void {
    const counts = this.inFlight.get(entryId);
    if (!counts) return;
    const next = (counts.get(credentialId) ?? 1) - 1;
    if (next <= 0) counts.delete(credentialId);
    else counts.set(credentialId, next);
    if (counts.size === 0) this.inFlight.delete(entryId);
  }

  inFlightCount(entryId: string, credentialId: string): number {
    return this.inFlight.get(entryId)?.get(credentialId) ?? 0;
  }

  reset(entryId?: string): void {
    if (entryId === undefined) {
      this.cursor.clear();
      this.inFlight.clear();
    } else {
      this.cursor.delete(entryId);
      this.inFlight.delete(entryId);
    }
  }
}
