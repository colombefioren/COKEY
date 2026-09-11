import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import { resolveMasterKey, type MasterKeyKind, type ResolveOptions } from "./keyring.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/** Prefix so the on-disk format is self-describing and versionable. */
const PAYLOAD_PREFIX = "v1:";

export interface SecretVaultOptions extends ResolveOptions {
  /** Defaults to the OS keychain unless disabled. */
  disableKeychain?: boolean;
}

/**
 * Encrypts credential secrets at rest with AES-256-GCM.
 *
 * Layout of an encrypted value: `v1:` + base64( iv || authTag || ciphertext ).
 * Plaintext secrets exist only inside this process, and only for the duration
 * of a request.
 */
export class SecretVault {
  private readonly key: Buffer;
  readonly keyKind: MasterKeyKind;

  constructor(options: SecretVaultOptions) {
    const resolved = resolveMasterKey(options);
    this.key = resolved.key;
    this.keyKind = resolved.kind;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PAYLOAD_PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64");
  }

  decrypt(payload: string): string {
    const body = payload.startsWith(PAYLOAD_PREFIX) ? payload.slice(PAYLOAD_PREFIX.length) : payload;
    const buf = Buffer.from(body, "base64");

    if (buf.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error("Encrypted secret is truncated");
    }

    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    try {
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      // GCM authentication failure: wrong key, or the value was tampered with.
      throw new Error("Unable to decrypt secret (wrong master key or corrupted data)");
    }
  }

  /** Stable, non-reversible identifier for the active key. Safe to log. */
  keyFingerprint(): string {
    return createCipheriv(ALGORITHM, this.key, Buffer.alloc(IV_LENGTH))
      .update("fingerprint")
      .digest("hex")
      .slice(0, 12);
  }

  /** Constant-time comparison used by tests and diagnostics. */
  static sameSecret(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}
