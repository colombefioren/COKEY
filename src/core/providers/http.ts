import type { ProviderError } from "../types.js";
import type { ProviderRequest, SendResult } from "./adapter.js";
import { dispatcherFor } from "./proxy.js";

export const DEFAULT_TIMEOUT_MS = 120_000;

export interface RequestOptions {
  timeoutMs?: number;

  signal?: AbortSignal;

  proxyUrl?: string;
}

type FetchInit = Omit<RequestInit, "dispatcher"> & { dispatcher?: unknown };

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

      redirect: "manual",
    };

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

export function getHeader(
  headers: Record<string, string> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
}

export function stripTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url.charCodeAt(end - 1) === 47) end--;
  return url.slice(0, end);
}

export function stripTrailingV1(url: string): string {
  const trimmed = stripTrailingSlashes(url);
  return trimmed.endsWith("/v1") ? trimmed.slice(0, -3) : trimmed;
}
