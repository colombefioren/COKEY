import { parseProxyUrl } from "./proxy.js";

export const PROXIFLY_FREE_LIST_URL =
  "https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/all/data.txt";

export const PROXIFLY_MAX_BYTES = 1_000_000;

export interface ProxiflyFetchOptions {
  timeoutMs?: number;

  maxEntries?: number;
}

export interface ProxiflyList {
  urls: string[];

  schemaSummary: string;
}

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
    } catch {}
  }

  return {
    urls,
    schemaSummary: [...schemes].sort().join(", "),
  };
}

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
