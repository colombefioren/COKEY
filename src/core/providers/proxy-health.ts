import type { ProxyDispatcher } from "./proxy.js";
import { dispatcherFor } from "./proxy.js";

/**
 * Cheap liveness probe for a pool exit.
 *
 * Judging a proxy "working" means proving a request can actually leave through
 * it. A connect to a tiny, fast, always-up endpoint through the proxy is the
 * cheapest test that does not hand the proxy any credentials: if the tunnel is
 * dead, we never see a response; if none of the endpoints below are reachable
 * either, the exit is useless for our traffic anyway.
 */

/** Default probe target. Returns `204 No Content` instantly, no body. */
export const DEFAULT_PROBE_TARGET = "https://www.gstatic.com/generate_204";

/** A timeout that stays comfortably below a normal request's patience. */
export const DEFAULT_PROBE_TIMEOUT_MS = 5_000;

export interface ProxyHealthResult {
  /** True when any HTTP response came back through the proxy. */
  ok: boolean;
  /** Round trip to the first response header, in milliseconds. */
  latencyMs: number;
  /** HTTP status of the probe response, when one arrived. */
  status?: number;
  /** Why the probe failed, when it did. */
  error?: string;
}

/**
 * `fetch` options carrying the undici `dispatcher`.
 *
 * `dispatcher` is redeclared as `unknown` because `@types/node` and the
 * `undici` package ship separate, mutually incompatible copies of its type.
 * Mirrors the declaration in `http.ts`.
 */
type FetchInit = Omit<RequestInit, "dispatcher"> & { dispatcher?: unknown };

/**
 * Probe one proxy URL. A response - any response - proves the tunnel carries
 * traffic; a 502 from the upstream is still a working exit.
 */
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

/**
 * Run `fn` over `items` with at most `limit` in flight at once, preserving
 * input order in the result - the same contract as `Promise.all`.
 */
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

/**
 * Probe a list of proxy URLs and keep only the ones that answer.
 *
 * This differs from `mapWithConcurrency` in two ways: callers hear back just
 * the surviving URLs (not a parallel result array), and probing stops early
 * once `limit` healthy exits are found - so "import 40 working proxies" does
 * not waste fifteen seconds watching the rest of the file time out.
 */
export async function collectHealthy(
  urls: readonly string[],
  options: {
    /** Stop probing once this many healthy exits are collected. Default: all. */
    limit?: number;
    /** Probes in flight at once. Default 10. */
    concurrency?: number;
    target?: string;
    timeoutMs?: number;
    /** Override the probe, for tests. Defaults to `checkProxyUrl`. */
    probe?: (url: string) => Promise<{ ok: boolean }>;
  } = {},
): Promise<{ healthy: string[]; checked: number }> {
  const limit = options.limit ?? urls.length;
  const concurrency = Math.min(Math.max(1, Math.floor(options.concurrency ?? 10)), Math.max(1, urls.length));
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