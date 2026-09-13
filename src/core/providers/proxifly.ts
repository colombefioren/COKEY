import { parseProxyUrl } from "./proxy.js";

/**
 * Proxifly free proxy list.
 *
 * Proxifly's paid REST API (api.proxifly.dev) bills per API key and is rate
 * limited (free tier ~100 requests/mo). The free list is a different thing: a
 * static file in a public GitHub repo served by the jsDelivr CDN. No API key,
 * no per-user quota - so a click-to-refresh button never gets billed. The
 * proxies themselves are public and shared: fine for egress diversity, but
 * expected to be slower, unstable, and sometimes already dead.
 */

export const PROXIFLY_FREE_LIST_URL =
  "https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/all/data.txt";

/** Ceiling on a single fetch, in bytes. ~60 KB today; plenty of headroom. */
export const PROXIFLY_MAX_BYTES = 1_000_000;

export interface ProxiflyFetchOptions {
  /** Milliseconds before the request is aborted. Default 15s. */
  timeoutMs?: number;
  /** Hard ceiling on how many proxies a single fetch may contain. */
  maxEntries?: number;
}

export interface ProxiflyList {
  /** Parsed proxy URLs (`socks5://…`), deduplicated, in file order. */
  urls: string[];
  /** Raw protocol schemes seen in the file, for the import log. */
  schemaSummary: string;
}

/**
 * Split a raw Proxifly text dump into valid proxy URLs.
 *
 * Lines already look like `socks5://host:port`, so each one goes through the
 * same validator the pool uses. Invalid rows (empty, garbage, unsupported
 * protocols like socks4) are skipped rather than poisoning the batch.
 */
export function parseProxiflyList(text: string, maxEntries?: number): ProxiflyList {
  const seen = new Set<string>();
  const urls: string[] = [];
  const schemes = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    const value = line.trim();
    if (!value) continue;
    try {
      const parsed = parseProxyUrl(value);
      if (!parsed) continue;
      schemes.add(parsed.protocol);
      if (seen.has(parsed.href)) continue;
      seen.add(parsed.href);
      urls.push(parsed.href);
      if (maxEntries !== undefined && maxEntries > 0 && urls.length >= maxEntries) break;
    } catch {
      // Skip a malformed row rather than failing the batch.
    }
  }

  return {
    urls,
    schemaSummary: [...schemes].sort().join(", "),
  };
}

/**
 * Download the current Proxifly free list.
 *
 * Fetched from jsDelivr (not Proxifly's API), so there is no key and no quota
 * to spend. A size ceiling stops a corrupted file from being buffered whole.
 */
export async function fetchProxiflyFreeList(options: ProxiflyFetchOptions = {}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(PROXIFLY_FREE_LIST_URL, {
      signal: controller.signal,
      headers: { accept: "text/plain" },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`Proxifly free list answered HTTP ${response.status}`);
    }

    const read = response.body?.getReader();
    if (!read) {
      throw new Error("Proxifly free list returned no body");
    }

    let total = 0;
    let tail = "";
    const chunks: string[] = [];
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await read.read();
      if (done) break;
      total += value.byteLength;
      if (total > PROXIFLY_MAX_BYTES) {
        throw new Error("Proxifly free list is unreasonably large");
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    tail = decoder.decode();
    return chunks.join("") + tail;
  } finally {
    clearTimeout(timer);
  }
}
