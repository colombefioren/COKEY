import type { CredentialStatus } from "./types.js";

/**
 * Guidance: turning gateway state into something a person can act on.
 *
 * COKEY knows a great deal that it never used to say. A key has been rejected
 * four times; a provider retired the model a chain's second node depends on; a
 * model list is three weeks old and the provider has shipped twice since. None
 * of that is visible in a count or a colour, and all of it has a specific,
 * small remedy.
 *
 * This module is a pure function over a plain snapshot of that state. It does
 * no I/O and knows nothing about HTTP, which is what makes the rules — which
 * condition is worth interrupting someone for, and what the remedy should be —
 * testable one at a time.
 *
 * Two principles run through every rule:
 *
 *   - Say what to do, not just what is wrong. A notice without an action is a
 *     complaint.
 *   - Prefer the cheapest fix. Re-verifying a key costs one request; replacing
 *     it costs the user a browser trip to a provider. Offer the re-verify first,
 *     because an unhealthy key is very often a rate limit that has since lifted.
 */

export type GuidanceSeverity = "info" | "warn" | "critical";

export type GuidanceKind =
  | "credential.rejected"
  | "credential.struggling"
  | "credential.never-verified"
  | "provider.all-keys-unusable"
  | "provider.models-stale"
  | "provider.models-never-checked"
  | "provider.models-outdated"
  | "chain.model-retired"
  | "chain.node-unkeyed"
  | "chain.node-unhealthy"
  | "chain.none"
  | "egress.saturated"
  | "coverage.free-providers";

/**
 * What the user can do about a notice.
 *
 * Deliberately a closed set rather than a free-form callback: these cross a JSON
 * boundary, and the UI needs to know it can render each one as a button that
 * does something real. `navigate` moves; the others call an endpoint.
 */
export type GuidanceAction =
  | { kind: "navigate"; label: string; path: string }
  | { kind: "refresh-models"; label: string; providerId: string }
  | { kind: "reverify-credential"; label: string; credentialId: string };

export interface GuidanceNotice {
  /** Stable across snapshots, so the UI can remember a dismissal. */
  id: string;
  kind: GuidanceKind;
  severity: GuidanceSeverity;
  title: string;
  detail: string;
  /** Ordered by preference: the first action is the one to try first. */
  actions: GuidanceAction[];
  providerId?: string;
  credentialId?: string;
  chainId?: string;
  entryId?: string;
}

export interface GuidanceCredential {
  id: string;
  providerId: string;
  providerName: string;
  description: string;
  status: CredentialStatus;
  cooldownUntil?: number;
  consecutiveFailures: number;
  lastVerifiedAt?: number;
  /** True when the pool owns this key's exit; used for context, not a notice. */
  proxyAuto: boolean;
}

export interface GuidanceProvider {
  id: string;
  displayName: string;
  connected: boolean;
  credentialCount: number;
  healthyCount: number;
  /** Absent when the model list has never been fetched. */
  inventoryCheckedAt?: number;
  /** Catalogued models the provider did not return last time it was asked. */
  staleModels: string[];
  /** Models currently listed for this provider, after reconciliation. */
  modelCount: number;
}

export interface GuidanceChain {
  id: string;
  alias: string;
  enabled: boolean;
  entries: Array<{
    id: string;
    providerId: string;
    providerName: string;
    model: string;
    label?: string;
    enabled: boolean;
    credentialCount: number;
    healthyCount: number;
  }>;
}

export interface GuidanceInput {
  now: number;
  chains: GuidanceChain[];
  credentials: GuidanceCredential[];
  providers: GuidanceProvider[];
  egress: {
    enabled: boolean;
    poolSize: number;
    /** Providers with more keys than the pool has exits. */
    saturatedProviders: string[];
  };
  coverage: {
    connectedFree: number;
    target: number;
    suggestions: Array<{ id: string; displayName: string }>;
  };
}

/** A cooldown longer than this is worth mentioning; anything shorter is normal. */
const COOLDOWN_NOTICE_MS = 5 * 60 * 1000;

/** A failure streak this long means the key is not coming back on its own. */
const FAILURE_STREAK_NOTICE = 3;

/** A model listing older than this is worth re-checking. */
const OUTDATED_INVENTORY_MS = 7 * 24 * 60 * 60 * 1000;

const SEVERITY_RANK: Record<GuidanceSeverity, number> = {
  critical: 0,
  warn: 1,
  info: 2,
};

/**
 * Derive the notices worth showing for one snapshot of gateway state.
 *
 * `max` caps the result, because a user with forty broken keys needs the first
 * five and a count, not forty rows that push the working part of the dashboard
 * off the screen.
 */
export function deriveGuidance(input: GuidanceInput, max = 12): GuidanceNotice[] {
  const notices: GuidanceNotice[] = [];
  const push = (notice: GuidanceNotice): void => {
    notices.push(notice);
  };

  const staleByProvider = new Map(
    input.providers.map((provider) => [provider.id, new Set(provider.staleModels)]),
  );

  // ---- credentials --------------------------------------------------------

  for (const credential of input.credentials) {
    const providerName = credential.providerName || credential.providerId;
    const label = `${credential.description} (${providerName})`;

    if (credential.status === "invalid") {
      push({
        id: `credential.rejected:${credential.id}`,
        kind: "credential.rejected",
        severity: "critical",
        title: `${credential.description} was rejected`,
        detail: `${providerName} refused this key. Re-verify it first — an expired quota and a revoked key look identical until you ask — and only replace it if the check fails again.`,
        actions: [
          { kind: "reverify-credential", label: "Re-verify now", credentialId: credential.id },
          { kind: "navigate", label: "Open chains", path: "/chains" },
        ],
        providerId: credential.providerId,
        credentialId: credential.id,
      });
      continue;
    }

    if (credential.status === "cooldown") {
      const remaining = (credential.cooldownUntil ?? 0) - input.now;
      const long =
        remaining > COOLDOWN_NOTICE_MS || credential.consecutiveFailures >= FAILURE_STREAK_NOTICE;
      if (!long) continue;
      push({
        id: `credential.struggling:${credential.id}`,
        kind: "credential.struggling",
        severity: "warn",
        title: `${credential.description} keeps cooling down`,
        detail:
          `${label} has failed ${credential.consecutiveFailures} time(s) in a row and is sitting out for another ` +
          `${Math.max(0, Math.round(remaining / 1000))}s. If the provider has already reset, re-verifying brings it back early.`,
        actions: [
          { kind: "reverify-credential", label: "Re-verify now", credentialId: credential.id },
          { kind: "navigate", label: "See usage", path: "/usage" },
        ],
        providerId: credential.providerId,
        credentialId: credential.id,
      });
      continue;
    }

    if (credential.status === "unverified" && credential.lastVerifiedAt === undefined) {
      push({
        id: `credential.never-verified:${credential.id}`,
        kind: "credential.never-verified",
        severity: "info",
        title: `${credential.description} has never verified`,
        detail: `${label} was saved without a successful check, so no chain should rely on it yet.`,
        actions: [
          { kind: "reverify-credential", label: "Verify now", credentialId: credential.id },
        ],
        providerId: credential.providerId,
        credentialId: credential.id,
      });
    }
  }

  // ---- providers ----------------------------------------------------------

  for (const provider of input.providers) {
    if (!provider.connected) continue;

    if (provider.healthyCount === 0 && provider.credentialCount > 0) {
      const bindable = input.credentials
        .filter((credential) => credential.providerId === provider.id)
        .sort((a, b) => b.consecutiveFailures - a.consecutiveFailures)[0];
      push({
        id: `provider.all-keys-unusable:${provider.id}`,
        kind: "provider.all-keys-unusable",
        severity: "warn",
        title: `Every ${provider.displayName} key is unusable`,
        detail:
          `${provider.credentialCount} key(s) are connected but none is healthy, so any chain with a ` +
          `${provider.displayName} node is skipping it. Re-verify the worst offender first.`,
        actions: [
          ...(bindable
            ? [
                {
                  kind: "reverify-credential" as const,
                  label: `Re-verify ${bindable.description}`,
                  credentialId: bindable.id,
                },
              ]
            : []),
          { kind: "refresh-models", label: "Refresh models", providerId: provider.id },
        ],
        providerId: provider.id,
      });
    }

    if (provider.staleModels.length > 0) {
      const sample = provider.staleModels.slice(0, 3).join(", ");
      const more =
        provider.staleModels.length > 3 ? ` and ${provider.staleModels.length - 3} more` : "";
      push({
        id: `provider.models-stale:${provider.id}`,
        kind: "provider.models-stale",
        severity: "warn",
        title: `${provider.displayName} no longer serves ${provider.staleModels.length} listed model(s)`,
        detail:
          `The last model check did not return ${sample}${more}. They are hidden from the picker, ` +
          `and any chain node using one will fail over. Refresh to re-check, or replace those nodes.`,
        actions: [
          { kind: "refresh-models", label: "Refresh models", providerId: provider.id },
          { kind: "navigate", label: "Open chains", path: "/chains" },
        ],
        providerId: provider.id,
      });
      continue;
    }

    if (provider.inventoryCheckedAt === undefined) {
      push({
        id: `provider.models-never-checked:${provider.id}`,
        kind: "provider.models-never-checked",
        severity: "info",
        title: `${provider.displayName} models have never been checked`,
        detail:
          "COKEY is showing the curated catalog for this provider. Fetching the real list tells you " +
          "which of those models the provider still serves.",
        actions: [{ kind: "refresh-models", label: "Fetch model list", providerId: provider.id }],
        providerId: provider.id,
      });
      continue;
    }

    if (input.now - provider.inventoryCheckedAt > OUTDATED_INVENTORY_MS) {
      const days = Math.round((input.now - provider.inventoryCheckedAt) / (24 * 60 * 60 * 1000));
      push({
        id: `provider.models-outdated:${provider.id}`,
        kind: "provider.models-outdated",
        severity: "info",
        title: `${provider.displayName} model list is ${days} days old`,
        detail: `Providers add and retire free models constantly. Re-check to see what changed.`,
        actions: [{ kind: "refresh-models", label: "Refresh now", providerId: provider.id }],
        providerId: provider.id,
      });
    }
  }

  // ---- chains -------------------------------------------------------------

  if (input.chains.length === 0) {
    push({
      id: "chain.none",
      kind: "chain.none",
      severity: "info",
      title: "No chains yet",
      detail:
        "A chain is the alias your tools call. Create one, add a node per provider, and point a client at /v1.",
      actions: [{ kind: "navigate", label: "Create a chain", path: "/chains" }],
    });
  }

  for (const chain of input.chains) {
    for (const entry of chain.entries) {
      const where = entry.label ?? entry.model;
      const providerName = entry.providerName || entry.providerId;
      const retired = staleByProvider.get(entry.providerId)?.has(entry.model) ?? false;

      if (entry.credentialCount === 0) {
        push({
          id: `chain.node-unkeyed:${entry.id}`,
          kind: "chain.node-unkeyed",
          severity: "critical",
          title: `"${where}" in ${chain.alias} has no keys`,
          detail: `The node exists but nothing can serve it, so the chain skips straight past it.`,
          actions: [
            { kind: "navigate", label: `Open ${chain.alias}`, path: `/chains?chain=${chain.id}` },
          ],
          providerId: entry.providerId,
          chainId: chain.id,
          entryId: entry.id,
        });
        continue;
      }

      if (retired) {
        push({
          id: `chain.model-retired:${entry.id}`,
          kind: "chain.model-retired",
          severity: "warn",
          title: `"${where}" is retired on ${providerName}`,
          detail:
            `${chain.alias} uses a model the provider did not return on the last check. ` +
            `Every request that reaches this node fails over, which costs latency for no benefit.`,
          actions: [
            { kind: "refresh-models", label: "Re-check", providerId: entry.providerId },
            { kind: "navigate", label: `Fix ${chain.alias}`, path: `/chains?chain=${chain.id}` },
          ],
          providerId: entry.providerId,
          chainId: chain.id,
          entryId: entry.id,
        });
        continue;
      }

      if (entry.healthyCount === 0 && entry.enabled) {
        push({
          id: `chain.node-unhealthy:${entry.id}`,
          kind: "chain.node-unhealthy",
          severity: "warn",
          title: `"${where}" has no healthy key`,
          detail:
            `${entry.credentialCount} key(s) are bound but all are cooling down, rejected or unverified. ` +
            `The chain will fall through this node until one recovers.`,
          actions: [
            { kind: "navigate", label: `Open ${chain.alias}`, path: `/chains?chain=${chain.id}` },
          ],
          providerId: entry.providerId,
          chainId: chain.id,
          entryId: entry.id,
        });
      }
    }
  }

  // ---- egress -------------------------------------------------------------

  if (input.egress.enabled && input.egress.saturatedProviders.length > 0) {
    push({
      id: "egress.saturated",
      kind: "egress.saturated",
      severity: "info",
      title: `${input.egress.saturatedProviders.length} provider(s) share exit IPs`,
      detail:
        `${input.egress.saturatedProviders.slice(0, 4).join(", ")} have more keys than the pool has exits, ` +
        `so those keys share a rate limit. Adding exits is what separates them.`,
      actions: [{ kind: "navigate", label: "Open egress pool", path: "/settings" }],
    });
  }

  // ---- coverage -----------------------------------------------------------

  if (
    input.coverage.connectedFree < input.coverage.target &&
    input.coverage.suggestions.length > 0
  ) {
    const names = input.coverage.suggestions.slice(0, 4).map((item) => item.displayName);
    push({
      id: "coverage.free-providers",
      kind: "coverage.free-providers",
      severity: "info",
      title: `${input.coverage.connectedFree} of ${input.coverage.target} free providers connected`,
      detail:
        `${names.join(", ")}${input.coverage.suggestions.length > names.length ? " and more" : ""} offer a free tier. ` +
        `Each one you connect is another node your chains can fall back to.`,
      actions: [{ kind: "navigate", label: "Browse providers", path: "/providers" }],
    });
  }

  return notices
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, max);
}

/** Counts by severity, for a badge that does not have to iterate the list. */
export function guidanceSummary(notices: GuidanceNotice[]): Record<GuidanceSeverity, number> {
  const summary: Record<GuidanceSeverity, number> = { critical: 0, warn: 0, info: 0 };
  for (const notice of notices) summary[notice.severity] += 1;
  return summary;
}
