import type { ProviderError } from "../types.js";
import type { ProviderRequest, SendResult } from "./adapter.js";
import { dispatcherFor } from "./proxy.js";

export const DEFAULT_TIMEOUT_MS = 120_000;

export interface RequestOptions {
  timeoutMs?: number;
  /** Extra signals to combine with the timeout. */
  signal?: AbortSignal;
  /**
   * Egress through this proxy instead of the process default.
   *
   * Defaults to the proxy declared on the request spec, so adapters that build
   * a request from a credential get per-credential egress for free.
   */
  proxyUrl?: string;
}

/**
 * `fetch` options carrying the undici `dispatcher`.
 *
 * `dispatcher` is redeclared as `unknown` because `@types/node` and the
 * `undici` package ship separate, mutually incompatible copies of its type.
 */
type FetchInit = Omit<RequestInit, "dispatcher"> & { dispatcher?: unknown };

/**
 * Execute a provider request.
 *
 * The timeout only covers the time to receive response headers. Once headers
 * arrive the timer is cleared so a long-lived streamed completion is never
 * aborted mid-flight — which would truncate a user's answer.
 */
export async function performRequest(
  spec: ProviderRequest,
  options: RequestOptions = {},
): Promise<SendResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Upstream timed out after ${timeoutMs}ms`)),
    timeoutMs,
  );

  const signal = options.signal
    ? (AbortSignal.any?.([controller.signal, options.signal]) ?? controller.signal)
    : controller.signal;

  const dispatcher = dispatcherFor(options.proxyUrl ?? spec.proxyUrl);

  try {
    const init: FetchInit = {
      method: spec.method,
      headers: spec.headers,
      body: spec.body,
      signal,
      // Never follow a redirect that would resend an Authorization header to a
      // different origin.
      redirect: "manual",
    };
    // Only set the field when a proxy is configured; otherwise the process
    // default agent stays in charge.
    if (dispatcher) init.dispatcher = dispatcher;

    const response = await fetch(spec.url, init as unknown as RequestInit);
    clearTimeout(timer);

    if (response.status >= 300 && response.status < 400) {
      return {
        ok: false,
        error: {
          status: response.status,
          message: `Upstream redirect to ${response.headers.get("location") ?? "unknown"} refused`,
          headers: headersToObject(response.headers),
        },
      };
    }

    if (!response.ok) {
      const { body, message } = await readErrorBody(response);
      return {
        ok: false,
        error: {
          status: response.status,
          message,
          body,
          headers: headersToObject(response.headers),
        },
      };
    }

    return { ok: true, response };
  } catch (error) {
    clearTimeout(timer);
    return { ok: false, error: toProviderError(error) };
  }
}

/** Normalise a thrown fetch/abort error into a ProviderError with no status. */
export function toProviderError(error: unknown): ProviderError {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    const causeMessage = cause instanceof Error ? cause.message : undefined;
    return {
      message: causeMessage ? `${error.message}: ${causeMessage}` : error.message,
      status: undefined,
    };
  }
  return { message: String(error), status: undefined };
}

async function readErrorBody(response: Response): Promise<{ body: unknown; message: string }> {
  const text = await safeText(response);
  let body: unknown = text;

  if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  const message = extractBodyMessage(body) ?? response.statusText ?? `HTTP ${response.status}`;
  return { body, message };
}

function extractBodyMessage(body: unknown): string | undefined {
  if (typeof body === "string") return body.slice(0, 500) || undefined;
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;

  const err = b.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
  }
  if (typeof b.message === "string") return b.message;
  if (typeof b.detail === "string") return b.detail;
  return undefined;
}

export async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

/** Case-insensitive header lookup for a plain record. */
export function getHeader(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
}
