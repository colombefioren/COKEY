import { isIP } from "node:net";

/**
 * SSRF guard for the one place a user may supply a URL: the deliberately buried
 * "custom OpenAI-compatible endpoint" option in Settings.
 *
 * Every catalog provider bypasses this check because its base URL is vetted
 * data shipped with COKEY. Custom endpoints are treated as hostile until the
 * user explicitly opts in.
 */

export interface UrlCheckResult {
  ok: boolean;
  reason?: string;
}

const METADATA_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
  "instance-data",
  "metadata.azure.com",
]);

export interface UrlGuardOptions {
  /** User has explicitly acknowledged private/loopback targets. */
  allowPrivate?: boolean;
}

/**
 * Validate a candidate provider base URL.
 *
 * Rejects non-HTTP(S) schemes, credentials in the URL, link-local/private
 * ranges and cloud metadata endpoints unless `allowPrivate` is set.
 *
 * Note: this is a syntactic/IP-literal check. It deliberately does not resolve
 * DNS, because a name that resolves to a private address at connect time could
 * resolve elsewhere later. Callers that need full rebinding protection should
 * pin the resolved address; COKEY documents this limitation rather than
 * pretending otherwise.
 */
export function validateEndpointUrl(raw: string, options: UrlGuardOptions = {}): UrlCheckResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Not a valid absolute URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `Unsupported scheme "${url.protocol.replace(":", "")}"` };
  }

  if (url.username || url.password) {
    return { ok: false, reason: "URLs with embedded credentials are not allowed" };
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (METADATA_HOSTS.has(host)) {
    return { ok: false, reason: "Cloud metadata endpoints are blocked" };
  }

  if (host === "localhost" || host.endsWith(".localhost")) {
    return options.allowPrivate
      ? { ok: true }
      : { ok: false, reason: "Loopback host blocked; enable private endpoints to allow it" };
  }

  if (host.endsWith(".internal") || host.endsWith(".local")) {
    return options.allowPrivate
      ? { ok: true }
      : { ok: false, reason: "Internal hostname blocked; enable private endpoints to allow it" };
  }

  // 169.254.169.254 and friends are link-local; block regardless of opt-in.
  if (isLinkLocal(host)) {
    return { ok: false, reason: "Link-local address blocked (cloud metadata range)" };
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4 && isPrivateV4(host)) {
    return options.allowPrivate
      ? { ok: true }
      : { ok: false, reason: "Private IPv4 address blocked; enable private endpoints to allow it" };
  }
  if (ipVersion === 6 && isPrivateV6(host)) {
    return options.allowPrivate
      ? { ok: true }
      : { ok: false, reason: "Private IPv6 address blocked; enable private endpoints to allow it" };
  }

  if (url.protocol === "http:" && !options.allowPrivate) {
    return { ok: false, reason: "Remote endpoints must use HTTPS" };
  }

  return { ok: true };
}

/** Throwing form used on the write path. */
export function assertSafeEndpoint(raw: string, options: UrlGuardOptions = {}): URL {
  const result = validateEndpointUrl(raw, options);
  if (!result.ok) throw new Error(`Unsafe endpoint: ${result.reason ?? "rejected"}`);
  return new URL(raw);
}

function isLinkLocal(host: string): boolean {
  if (isIP(host) !== 4) return false;
  const [a, b] = host.split(".").map(Number);
  return a === 169 && b === 254;
}

function isPrivateV4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  return false;
}

function isPrivateV6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local
  if (h.startsWith("fe80")) return true; // link-local
  if (h.startsWith("::ffff:")) return isPrivateV4(h.slice(7));
  return false;
}
