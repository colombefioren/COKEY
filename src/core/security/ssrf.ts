import { isIP } from "node:net";

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
  allowPrivate?: boolean;
}

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

export function assertSafeEndpoint(raw: string, options: UrlGuardOptions = {}): URL {
  const result = validateEndpointUrl(raw, options);
  if (!result.ok) throw new Error(`Unsafe endpoint: ${result.reason ?? "rejected"}`);
  return new URL(raw);
}

function isLinkLocal(host: string): boolean {
  if (isIP(host) === 4) {
    const [a, b] = host.split(".").map(Number);
    return a === 169 && b === 254;
  }
  const mapped = mappedIPv4(host);
  return mapped !== undefined && isLinkLocal(mapped);
}

function mappedIPv4(host: string): string | undefined {
  const groups = expandIPv6(host);
  if (!groups) return undefined;
  if (groups.slice(0, 5).some((g) => g !== 0) || groups[5] !== 0xffff) return undefined;
  return [
    (groups[6]! >> 8) & 0xff,
    groups[6]! & 0xff,
    (groups[7]! >> 8) & 0xff,
    groups[7]! & 0xff,
  ].join(".");
}

function expandIPv6(host: string): number[] | undefined {
  if (isIP(host) !== 6) return undefined;

  let addr = host;
  let ipv4Tail: string | undefined;
  const lastColon = addr.lastIndexOf(":");
  const tail = addr.slice(lastColon + 1);
  if (tail.includes(".")) {
    ipv4Tail = tail;
    addr = addr.slice(0, lastColon + 1);
  }

  const [head, tailPart] = addr.split("::");
  const headGroups = head ? head.split(":").filter(Boolean) : [];
  const tailGroups = tailPart !== undefined ? tailPart.split(":").filter(Boolean) : [];

  let hex: string[];
  if (tailPart !== undefined) {
    const known = headGroups.length + tailGroups.length + (ipv4Tail ? 2 : 0);
    const missing = 8 - known;
    if (missing < 0) return undefined;
    hex = [...headGroups, ...Array(missing).fill("0"), ...tailGroups];
  } else {
    hex = [...headGroups, ...tailGroups];
  }

  if (ipv4Tail) {
    const parts = ipv4Tail.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return undefined;
    }
    hex.push((((parts[0]! << 8) | parts[1]!) >>> 0).toString(16));
    hex.push((((parts[2]! << 8) | parts[3]!) >>> 0).toString(16));
  }

  if (hex.length !== 8) return undefined;
  return hex.map((g) => parseInt(g, 16));
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
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateV6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true;
  if (h.startsWith("fe80")) return true;
  const mapped = mappedIPv4(h);
  if (mapped !== undefined) return isPrivateV4(mapped);
  return false;
}
