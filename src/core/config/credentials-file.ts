import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { parseMiniYaml } from "./mini-yaml.js";
import type { Cokey } from "../cokey.js";

/**
 * Environment-variable credentials.
 *
 * Lets a headless machine declare where its keys live instead of pasting them
 * into the UI:
 *
 *     credentials:
 *       - description: Main Groq
 *         provider: groq
 *         model: qwen/qwen3.8-27b
 *         env: GROQ_KEY_1
 *
 * The file never contains the secret itself — only the name of the environment
 * variable that does.
 */
export const CredentialFileSchema = z.object({
  credentials: z
    .array(
      z.object({
        description: z.string().min(1),
        env: z.string().min(1),
        provider: z.string().min(1),
        model: z.string().min(1).optional(),
        chain: z.string().min(1).optional(),
        accountId: z.string().min(1).optional(),
      }),
    )
    .default([]),
});

export type CredentialFileEntry = z.infer<typeof CredentialFileSchema>["credentials"][number];

export interface CredentialFileResult {
  created: number;
  attached: number;
  skipped: number;
  errors: string[];
}

export function loadCredentialFile(path: string): CredentialFileEntry[] {
  if (!existsSync(path)) throw new Error(`Credential file not found: ${path}`);
  const raw = readFileSync(path, "utf8");

  const parsed = raw.trimStart().startsWith("{")
    ? (JSON.parse(raw) as unknown)
    : parseMiniYaml(raw);

  const result = CredentialFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid credential file: ${result.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  return result.data.credentials;
}

/**
 * Create credentials declared in a file and bind them to matching chain
 * entries. Secrets are read from the environment at this moment and stored
 * encrypted; they are never written back to the file.
 */
export function applyCredentialFile(
  cokey: Cokey,
  entries: CredentialFileEntry[],
  env: NodeJS.ProcessEnv = process.env,
): CredentialFileResult {
  const result: CredentialFileResult = { created: 0, attached: 0, skipped: 0, errors: [] };

  for (const entry of entries) {
    const secret = env[entry.env];
    if (!secret || !secret.trim()) {
      result.skipped += 1;
      result.errors.push(`${entry.description}: environment variable ${entry.env} is not set`);
      continue;
    }
    if (!cokey.providers.findCatalogEntry(entry.provider)) {
      result.skipped += 1;
      result.errors.push(`${entry.description}: unknown provider ${entry.provider}`);
      continue;
    }

    // Avoid duplicating a credential that is already stored under the same
    // provider and description.
    const existing = cokey.credentials
      .listByProvider(entry.provider)
      .find((credential) => credential.description === entry.description);

    const credential =
      existing ??
      cokey.credentials.create({
        providerId: entry.provider,
        accountId: entry.accountId,
        secret: secret.trim(),
        description: entry.description,
      });

    if (!existing) result.created += 1;

    if (entry.model) {
      result.attached += attachToChains(cokey, entry, credential.id);
    }
  }

  return result;
}

function attachToChains(cokey: Cokey, entry: CredentialFileEntry, credentialId: string): number {
  let attached = 0;

  for (const chain of cokey.chains.listChains()) {
    if (entry.chain && chain.alias !== entry.chain) continue;

    for (const chainEntry of cokey.chains.listEntries(chain.id)) {
      if (chainEntry.providerId !== entry.provider) continue;
      if (entry.model && chainEntry.model !== entry.model) continue;
      if (chainEntry.credentialIds.includes(credentialId)) continue;

      cokey.chains.addCredentialToEntry(chainEntry.id, credentialId);
      attached += 1;
    }
  }

  return attached;
}
