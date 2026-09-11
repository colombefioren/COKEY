import type { QuotaInfo } from "../types.js";

/** Header names COKEY understands. Anything absent stays absent. */
const HEADERS = {
  requestsRemaining: "x-ratelimit-remaining-requests",
  tokensRemaining: "x-ratelimit-remaining-tokens",
  inputTokensRemaining: "x-ratelimit-remaining-input-tokens",
  outputTokensRemaining: "x-ratelimit-remaining-output-tokens",
  requestsPerMinute: "x-ratelimit-limit-requests",
  tokensPerMinute: "x-ratelimit-limit-tokens",
  resetAt: "x-ratelimit-reset-requests",
} as const;

type HeaderSource = Headers | Record<string, string> | Map<string, string>;

function readHeader(headers: HeaderSource, name: string): string | undefined {
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  if (headers instanceof Map) return headers.get(name);
  return headers[name] ?? headers[name.toLowerCase()];
}

/**
 * Parse rate-limit headers from a provider response.
 *
 * COKEY never invents quota numbers. When a provider exposes nothing useful the
 * result is `{ available: false, source: "unknown" }` — "Quota: Unknown" is a
 * valid, expected state, not a bug.
 */
export function parseQuota(headers: HeaderSource): QuotaInfo {
  const out: Partial<QuotaInfo> = {};
  let any = false;

  const numeric: Array<[keyof typeof HEADERS, keyof QuotaInfo]> = [
    ["requestsRemaining", "requestsRemaining"],
    ["tokensRemaining", "tokensRemaining"],
    ["inputTokensRemaining", "inputTokensRemaining"],
    ["outputTokensRemaining", "outputTokensRemaining"],
    ["requestsPerMinute", "requestsPerMinute"],
    ["tokensPerMinute", "tokensPerMinute"],
  ];

  for (const [headerKey, target] of numeric) {
    const value = toInt(readHeader(headers, HEADERS[headerKey]));
    if (value !== undefined) {
      (out as Record<string, unknown>)[target] = value;
      any = true;
    }
  }

  const resetRaw = readHeader(headers, HEADERS.resetAt);
  if (resetRaw !== undefined) {
    const resetAt = parseResetValue(resetRaw);
    if (resetAt !== undefined) {
      out.resetAt = resetAt;
      any = true;
    }
  }

  if (!any) return { available: false, source: "unknown" };
  return { available: true, source: "provider", ...out };
}

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value.trim());
  if (!Number.isFinite(n)) return undefined;
  return n;
}

/**
 * Interpret `x-ratelimit-reset-*`.
 *
 * Providers are inconsistent here: values may be relative seconds, relative
 * milliseconds, a duration string ("1m30s"), an ISO timestamp, or an epoch. We
 * return an absolute timestamp when we can, otherwise `undefined`.
 */
export function parseResetValue(value: string): number | undefined {
  const t = value.trim();

  const duration = t.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/);
  if (duration) {
    const n = Number(duration[1]);
    const unit = duration[2];
    const mult = unit === "ms" ? 1 : unit === "s" ? 1000 : unit === "m" ? 60_000 : 3_600_000;
    return Date.now() + n * mult;
  }

  if (/^\d+$/.test(t)) {
    const n = Number(t);
    // A bare integer below 1e10 is far more likely to be a relative second
    // count than an epoch timestamp.
    return n < 1e10 ? Date.now() + n * 1000 : n;
  }

  const when = Date.parse(t);
  if (!Number.isNaN(when)) return when;
  return undefined;
}
