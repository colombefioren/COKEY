import type { ProxyDispatcher } from "./proxy.js";
import { dispatcherFor } from "./proxy.js";

export const DEFAULT_PROBE_TARGET = "https://www.gstatic.com/generate_204";

export const DEFAULT_PROBE_TIMEOUT_MS = 5_000;

export interface ProxyHealthResult {
  ok: boolean;

  latencyMs: number;

  status?: number;

  error?: string;
}

type FetchInit = Omit<RequestInit, "dispatcher"> & { dispatcher?: unknown };

export async function checkProxyUrl(
  proxyUrl: string,
  options: { target?: string; timeoutMs?: number } = {},
): Promise<ProxyHealthResult> {
  const target = options.target ?? DEFAULT_PROBE_TARGET;
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const started = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const dispatcher = dispatcherFor(proxyUrl) as ProxyDispatcher | undefined;

  try {
    const init: FetchInit = {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      dispatcher,
    };
    const response = await fetch(target, init as unknown as RequestInit);
    return {
      ok: true,
      latencyMs: Date.now() - started,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]!, index);
    }
  }

  const workerCount = Math.min(Math.max(1, Math.floor(limit)), Math.max(1, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function collectHealthy(
  urls: readonly string[],
  options: {
    limit?: number;

    concurrency?: number;
    target?: string;
    timeoutMs?: number;

    probe?: (url: string) => Promise<{ ok: boolean }>;
  } = {},
): Promise<{ healthy: string[]; checked: number }> {
  const limit = options.limit ?? urls.length;
  const concurrency = Math.min(
    Math.max(1, Math.floor(options.concurrency ?? 10)),
    Math.max(1, urls.length),
  );
  const probe = options.probe ?? checkProxyUrl;

  const healthy: string[] = [];
  let checked = 0;
  let next = 0;

  async function worker(): Promise<void> {
    while (next < urls.length && healthy.length < limit) {
      const index = next;
      next += 1;
      const verdict = await probe(urls[index]!);
      checked += 1;
      if (verdict.ok) healthy.push(urls[index]!);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { healthy, checked };
}
