import type { ChainEntry, Credential, ErrorClassification } from "../types.js";

/**
 * A live model probe.
 *
 * This is the "play button": it sends one tiny real completion through a key
 * that already works, so the verdict reflects the model and the key together
 * rather than a cached status. The default message is a plain hello, because a
 * probe that asks for something clever turns into a prompt-engineering problem
 * instead of a connectivity check.
 */

export const PROBE_MESSAGE = "hello";

export interface ModelProbeResult {
  ok: boolean;
  providerId: string;
  model: string;
  /** Display name the UI should use. Never auto-generated from the model id. */
  label?: string;
  credentialId?: string;
  credentialDescription?: string;
  /** Upstream HTTP status, when a response was received at all. */
  status?: number;
  latencyMs: number;
  classification: ErrorClassification;
  message?: string;
  /** First characters of the model's reply, for a quick sanity read. */
  reply?: string;
  proxyLabel?: string;
}

/** Rank credentials so the probe prefers a key that is actually usable. */
export function credentialRank(credential: Credential): number {
  switch (credential.status) {
    case "healthy":
      return 0;
    case "unverified":
      return 1;
    case "cooldown":
      return 2;
    case "disabled":
      return 3;
    default:
      return 4;
  }
}

/**
 * Pick the key a probe should use: an explicit one when given, otherwise the
 * healthiest bound key. Returns undefined when there is nothing to probe with.
 */
export function selectProbeCredential(
  credentials: Credential[],
  preferredId?: string,
): Credential | undefined {
  if (preferredId) {
    const preferred = credentials.find((credential) => credential.id === preferredId);
    if (preferred) return preferred;
  }
  return [...credentials].sort((a, b) => credentialRank(a) - credentialRank(b))[0];
}

/** The synthetic entry a probe is sent through. */
export function probeEntry(providerId: string, model: string, baseUrl: string): ChainEntry {
  const now = Date.now();
  return {
    id: "probe",
    chainId: "probe",
    providerId,
    model,
    baseUrl,
    credentialIds: [],
    enabled: true,
    priority: 0,
    routingStrategy: "sequential",
    createdAt: now,
    updatedAt: now,
  };
}
