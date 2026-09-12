import type { ErrorClassification, ProviderError } from "../types.js";

/**
 * Turn an upstream failure into a routing decision.
 *
 * The classification is the single input that drives credential rotation,
 * cooldowns and entry fallback, so it errs towards "do not rotate" only for
 * errors that are provably about the request rather than the credential.
 */
export function classifyError(error: ProviderError): ErrorClassification {
  const status = error.status;
  const message = extractMessage(error.body) ?? error.message ?? "";
  const lower = message.toLowerCase();

  // Context-window overflows arrive as 400 with a distinctive phrase. This is a
  // request-shaped error: rotating the credential would fail identically.
  if (
    status === 400 &&
    /context|too (long|large|many tokens)|maximum context|token limit|input is too long/i.test(lower)
  ) {
    return "context_too_large";
  }

  if (status === 401) return "credential_invalid";

  if (status === 403) {
    // 403 is overloaded: some providers use it for a rejected key, others for
    // exhausted quota or unpaid billing.
    if (/quota|billing|credit|payment|exhaust|insufficient/i.test(lower)) {
      return "quota_exhausted";
    }
    return "credential_invalid";
  }

  if (status === 429) {
    if (/quota|credit|exhaust|billing|insufficient|daily limit|out of/i.test(lower)) {
      return "quota_exhausted";
    }
    return "credential_rate_limited";
  }

  if (status === 400 || status === 422) return "invalid_request";

  if (status === 404) return "model_unavailable";

  if (status === 408 || status === 409) return "temporary_provider_error";

  if (status !== undefined && status >= 500) return "temporary_provider_error";

  if (status === undefined) {
    // No HTTP response at all: the request never reached a provider decision.
    if (/fetch|network|econn|enotfound|eai_again|timeout|timed out|abort|socket|dns/i.test(lower)) {
      return "network_error";
    }
    return "unknown";
  }

  return "unknown";
}

/** Pull the most specific human-readable message out of an arbitrary body. */
export function extractMessage(body: unknown): string | undefined {
  if (typeof body === "string") return body;
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;

  const err = b.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
    if (typeof e.type === "string") return e.type;
  }

  if (Array.isArray(b.errors) && b.errors.length > 0) {
    const first = b.errors[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && typeof (first as Record<string, unknown>).message === "string") {
      return (first as Record<string, string>).message;
    }
  }

  if (typeof b.detail === "string") return b.detail;
  if (typeof b.message === "string") return b.message;

  // Google-style rejection payload.
  if (b.error && typeof b.error === "object") {
    const e = b.error as { details?: Array<{ reason?: string }> };
    const reason = e.details?.[0]?.reason;
    if (reason) return reason;
  }
  return undefined;
}

/** Rotating to another credential can plausibly fix these. */
export function isCredentialScoped(c: ErrorClassification): boolean {
  return c === "credential_rate_limited" || c === "credential_invalid" || c === "quota_exhausted";
}

/** Reserved for future use. Currently no classification halts routing outright. */
export function isRequestScoped(_c: ErrorClassification): boolean {
  return false;
}

/** This entry's model is unreachable; try the next entry. */
export function isEntryScoped(c: ErrorClassification): boolean {
  return c === "model_unavailable";
}

/** Retrying, possibly after a short wait, is reasonable. */
export function isRetryable(c: ErrorClassification): boolean {
  return c === "temporary_provider_error" || c === "network_error";
}
