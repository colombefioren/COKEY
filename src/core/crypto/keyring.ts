import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

export type MasterKeyKind = "env" | "keychain" | "passphrase" | "keyfile";

export interface MasterKey {
  key: Buffer;
  kind: MasterKeyKind;
}

const KEY_BYTES = 32;
const KEYCHAIN_SERVICE = "cokey";
const KEYCHAIN_ACCOUNT = "master-key";

export interface ResolveOptions {
  dataDir: string;

  passphrase?: string;

  disableKeychain?: boolean;
}

export function resolveMasterKey(options: ResolveOptions): MasterKey {
  const fromEnv = readEnvKey(process.env.COKEY_MASTER_KEY);
  if (fromEnv) return { key: fromEnv, kind: "env" };

  const passphrase = options.passphrase ?? process.env.COKEY_PASSPHRASE;
  if (passphrase) {
    return { key: deriveFromPassphrase(passphrase, options.dataDir), kind: "passphrase" };
  }

  if (!options.disableKeychain) {
    const fromKeychain = readKeychain();
    if (fromKeychain) return { key: fromKeychain, kind: "keychain" };
  }

  return { key: readOrCreateKeyFile(options.dataDir), kind: "keyfile" };
}

export function storeKeyInKeychain(key: Buffer): boolean {
  const hex = key.toString("hex");
  try {
    const tool = keychainStoreCommand();
    if (!tool) return false;
    execFileSync(tool.cmd, tool.args, {
      input: hex,
      stdio: ["pipe", "ignore", "ignore"],
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

function readKeychain(): Buffer | undefined {
  try {
    const tool = keychainLookupCommand();
    if (!tool) return undefined;
    const out = execFileSync(tool.cmd, tool.args, {
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
      encoding: "utf8",
    }).trim();
    return parseKeyString(out);
  } catch {
    return undefined;
  }
}

function keychainLookupCommand(): { cmd: string; args: string[] } | undefined {
  switch (process.platform) {
    case "linux":
      return {
        cmd: "secret-tool",
        args: ["lookup", "service", KEYCHAIN_SERVICE, "account", KEYCHAIN_ACCOUNT],
      };
    case "darwin":
      return {
        cmd: "security",
        args: ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT, "-w"],
      };
    case "win32":
      return {
        cmd: "powershell",
        args: [
          "-NoProfile",
          "-Command",
          `(Get-StoredCredential -Target '${KEYCHAIN_SERVICE}-${KEYCHAIN_ACCOUNT}').GetNetworkCredential().Password`,
        ],
      };
    default:
      return undefined;
  }
}

function keychainStoreCommand(): { cmd: string; args: string[] } | undefined {
  switch (process.platform) {
    case "linux":
      return {
        cmd: "secret-tool",
        args: [
          "store",
          "--label",
          "COKEY master key",
          "service",
          KEYCHAIN_SERVICE,
          "account",
          KEYCHAIN_ACCOUNT,
        ],
      };
    case "darwin":
      return {
        cmd: "security",
        args: ["add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT, "-w"],
      };
    default:
      return undefined;
  }
}

function readEnvKey(raw: string | undefined): Buffer | undefined {
  if (!raw) return undefined;
  return parseKeyString(raw);
}

export function parseKeyString(raw: string): Buffer | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  if (/^[0-9a-fA-F]{64}$/.test(value)) return Buffer.from(value, "hex");
  try {
    const buf = Buffer.from(value, "base64");
    if (buf.length === KEY_BYTES) return buf;
  } catch {}
  return undefined;
}

export function deriveFromPassphrase(passphrase: string, dataDir: string): Buffer {
  const salt = Buffer.from(`cokey:v1:${dataDir}`);
  return scryptSync(passphrase, salt, KEY_BYTES, { N: 1 << 15, r: 8, p: 1 });
}

function readOrCreateKeyFile(dataDir: string): Buffer {
  mkdirSync(dataDir, { recursive: true });
  const keyPath = join(dataDir, "master.key");

  if (existsSync(keyPath)) {
    const parsed = parseKeyString(readFileSync(keyPath, "utf8"));
    if (!parsed) throw new Error(`master.key is corrupt or not 32 bytes: ${keyPath}`);
    return parsed;
  }

  const key = randomBytes(KEY_BYTES);
  writeFileSync(keyPath, key.toString("hex"), { mode: 0o600 });

  storeKeyInKeychain(key);
  return key;
}
