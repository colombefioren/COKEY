export function maskSecret(secret: string): string {
  if (!secret) return "•••";
  if (secret.length <= 8) return "•".repeat(secret.length);

  const prefixMatch = secret.match(/^[a-zA-Z]{1,6}[-_]/);
  const prefix = prefixMatch ? prefixMatch[0] : secret.slice(0, 3);
  const suffix = secret.slice(-4);
  return `${prefix}...${suffix}`;
}

export function maskAccountId(accountId: string | undefined): string | undefined {
  if (!accountId) return undefined;
  if (accountId.length <= 8) return "•".repeat(accountId.length);
  return `${accountId.slice(0, 4)}…${accountId.slice(-4)}`;
}
