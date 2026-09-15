import type { ChainEntry, Credential, ErrorClassification } from "../types.js";

export const PROBE_MESSAGE = "hello";

export interface ModelProbeResult {
  ok: boolean;
  providerId: string;
  model: string;

  label?: string;
  credentialId?: string;
  credentialDescription?: string;

  status?: number;
  latencyMs: number;
  classification: ErrorClassification;
  message?: string;

  reply?: string;
  proxyLabel?: string;
}

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
