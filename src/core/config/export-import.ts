import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import type { Cokey } from "../cokey.js";
import type { RoutingStrategy } from "../types.js";

/**
 * Portable configuration export.
 *
 * Exports everything needed to recreate a COKEY setup *except the secrets*:
 * chain order, descriptions, priorities, routing strategies and credential
 * descriptions (which are labels, not keys). Importing therefore rebinds
 * existing credentials rather than restoring them.
 */

export const EXPORT_VERSION = 1;

export interface ExportedEntry {
  providerId: string;
  model: string;
  baseUrl: string;
  priority: number;
  routingStrategy: RoutingStrategy;
  enabled: boolean;
  credentialDescriptions: string[];
}

export interface ExportedChain {
  alias: string;
  description?: string;
  enabled: boolean;
  entries: ExportedEntry[];
}

export interface ExportedCredentialLabel {
  providerId: string;
  description: string;
  accountIdPresent: boolean;
}

export interface CokeyExport {
  version: number;
  generator: string;
  exportedAt: string;
  settings: {
    port: number;
    host: string;
    logLevel: string;
    showFreeProviderNudger: boolean;
    freeProviderTarget: number;
    fallback: Record<string, unknown>;
  };
  chains: ExportedChain[];
  credentialLabels: ExportedCredentialLabel[];
}

export const ExportedEntrySchema = z.object({
  providerId: z.string(),
  model: z.string(),
  baseUrl: z.string().optional(),
  priority: z.number().optional(),
  routingStrategy: z.enum(["sequential", "round-robin"]).optional(),
  enabled: z.boolean().optional(),
  credentialDescriptions: z.array(z.string()).optional(),
});

export const CokeyExportSchema = z.object({
  version: z.number(),
  chains: z.array(
    z.object({
      alias: z.string(),
      description: z.string().optional(),
      enabled: z.boolean().optional(),
      entries: z.array(ExportedEntrySchema).default([]),
    }),
  ),
});

export function exportConfig(cokey: Cokey): CokeyExport {
  const settings = cokey.settings;

  return {
    version: EXPORT_VERSION,
    generator: "cokey",
    exportedAt: new Date().toISOString(),
    settings: {
      port: settings.port,
      host: settings.host,
      logLevel: settings.logLevel,
      showFreeProviderNudger: settings.showFreeProviderNudger,
      freeProviderTarget: settings.freeProviderTarget,
      fallback: { ...settings.fallback },
    },
    chains: cokey.chains.listChains().map((chain) => ({
      alias: chain.alias,
      description: chain.description,
      enabled: chain.enabled,
      entries: cokey.chains.listEntries(chain.id).map((entry) => ({
        providerId: entry.providerId,
        model: entry.model,
        baseUrl: entry.baseUrl,
        priority: entry.priority,
        routingStrategy: entry.routingStrategy,
        enabled: entry.enabled,
        credentialDescriptions: cokey.credentials
          .listByIds(entry.credentialIds)
          .map((credential) => credential.description),
      })),
    })),
    credentialLabels: cokey.credentials.listAll().map((credential) => ({
      providerId: credential.providerId,
      description: credential.description,
      accountIdPresent: Boolean(credential.accountId),
    })),
  };
}

export function serializeExport(cokey: Cokey): string {
  return `${JSON.stringify(exportConfig(cokey), null, 2)}\n`;
}

export function writeExport(cokey: Cokey, path: string): string {
  const payload = serializeExport(cokey);
  // Guard against ever writing a key by accident: the export must not contain
  // anything that looks like a bearer token.
  if (/(sk-[A-Za-z0-9]{16,}|gsk_[A-Za-z0-9]{16,}|Bearer\s+\S{16,})/.test(payload)) {
    throw new Error("Refusing to write export: it appears to contain a secret");
  }
  writeFileSync(path, payload, { mode: 0o600 });
  return path;
}

export interface ImportSummary {
  chainsCreated: number;
  chainsUpdated: number;
  entriesCreated: number;
  entriesSkipped: number;
  credentialsMatched: number;
  warnings: string[];
}

export interface ImportOptions {
  /** Import settings carried in the file. Defaults to false. */
  settings?: boolean;
}

/**
 * Merge an exported configuration into an existing database.
 *
 * Chains are matched by alias, entries by provider+model. Existing entries are
 * left alone and reported as skipped rather than being overwritten.
 */
export function importConfig(
  cokey: Cokey,
  data: unknown,
  options: ImportOptions = {},
): ImportSummary {
  const parsed = CokeyExportSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Invalid COKEY export: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }

  const summary: ImportSummary = {
    chainsCreated: 0,
    chainsUpdated: 0,
    entriesCreated: 0,
    entriesSkipped: 0,
    credentialsMatched: 0,
    warnings: [],
  };

  for (const exportedChain of parsed.data.chains) {
    const existing = cokey.chains.getChainByAlias(exportedChain.alias);
    const chain =
      existing ??
      cokey.chains.createChain({
        alias: exportedChain.alias,
        description: exportedChain.description,
      });

    if (existing) summary.chainsUpdated += 1;
    else summary.chainsCreated += 1;

    if (exportedChain.enabled === false) cokey.chains.setChainEnabled(chain.id, false);

    const currentEntries = cokey.chains.listEntries(chain.id);
    const seen = new Set(currentEntries.map((entry) => `${entry.providerId}::${entry.model}`));
    const orderedIds = currentEntries.map((entry) => entry.id);

    for (const exportedEntry of exportedChain.entries) {
      const key = `${exportedEntry.providerId}::${exportedEntry.model}`;
      if (seen.has(key)) {
        summary.entriesSkipped += 1;
        continue;
      }

      const catalogEntry = cokey.providers.findCatalogEntry(exportedEntry.providerId);
      if (!catalogEntry) {
        summary.warnings.push(`Skipped unknown provider: ${exportedEntry.providerId}`);
        summary.entriesSkipped += 1;
        continue;
      }

      // Rebind whatever credentials already exist on this machine that match
      // the exported labels; secrets cannot travel in an export.
      const wanted = new Set(exportedEntry.credentialDescriptions ?? []);
      const available = cokey.credentials
        .listByProvider(exportedEntry.providerId)
        .filter((credential) => wanted.size === 0 || wanted.has(credential.description))
        .map((credential) => credential.id);

      summary.credentialsMatched += available.length;
      if (available.length === 0) {
        summary.warnings.push(
          `Entry ${exportedEntry.providerId}/${exportedEntry.model} has no matching credential on this machine`,
        );
      }

      const entry = cokey.chains.addEntry({
        chainId: chain.id,
        providerId: exportedEntry.providerId,
        model: exportedEntry.model,
        baseUrl: exportedEntry.baseUrl ?? catalogEntry.baseUrl,
        credentialIds: available,
        routingStrategy: exportedEntry.routingStrategy,
        enabled: exportedEntry.enabled,
      });

      seen.add(key);
      orderedIds.push(entry.id);
      summary.entriesCreated += 1;
    }

    cokey.chains.reorder(chain.id, orderedIds);
  }

  if (options.settings && isRecord(data) && isRecord(data.settings)) {
    const settings = data.settings as Record<string, unknown>;
    cokey.settingsService.update({
      ...(typeof settings.port === "number" ? { port: settings.port } : {}),
      ...(typeof settings.host === "string" ? { host: settings.host } : {}),
      ...(typeof settings.logLevel === "string"
        ? { logLevel: settings.logLevel as "debug" | "info" | "warn" | "error" }
        : {}),
      ...(typeof settings.showFreeProviderNudger === "boolean"
        ? { showFreeProviderNudger: settings.showFreeProviderNudger }
        : {}),
      ...(typeof settings.freeProviderTarget === "number"
        ? { freeProviderTarget: settings.freeProviderTarget }
        : {}),
    });
  }

  return summary;
}

export function importFromFile(
  cokey: Cokey,
  path: string,
  options: ImportOptions = {},
): ImportSummary {
  if (!existsSync(path)) throw new Error(`Import file not found: ${path}`);
  return importConfig(cokey, JSON.parse(readFileSync(path, "utf8")) as unknown, options);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
