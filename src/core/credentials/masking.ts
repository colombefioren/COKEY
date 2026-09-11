/**
 * Masking helpers.
 *
 * These are the only functions permitted to turn stored material into
 * user-visible strings. Raw secrets never cross an HTTP boundary.
 */

/**
 * Mask a secret for display, preserving vendor prefixes and a short suffix so a
 * user can tell two keys apart without being able to reuse either.
 *
 *   sk-1234567890abcdef -> sk-...cdef
 *   abc                 -> •••
 */
export function maskSecret(secret: string): string {
  if (!secret) return "•••";
  if (secret.length <= 8) return "•".repeat(secret.length);

  // Preserve vendor prefixes such as "sk-", "gsk_", "xai-", "hf_".
  const prefixMatch = secret.match(/^[a-zA-Z]{1,6}[-_]/);
  const prefix = prefixMatch ? prefixMatch[0] : secret.slice(0, 3);
  const suffix = secret.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Mask a Cloudflare-style account id, which is an identifier rather than a
 * secret but is still not returned in full.
 */
export function maskAccountId(accountId: string | undefined): string | undefined {
  if (!accountId) return undefined;
  if (accountId.length <= 8) return "•".repeat(accountId.length);
  return `${accountId.slice(0, 4)}…${accountId.slice(-4)}`;
}
