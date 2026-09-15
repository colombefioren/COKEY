import { ProxyAgent, Socks5ProxyAgent } from "undici";

export interface ProxyDispatcher {
  close(): Promise<void>;
}

const dispatcherCache = new Map<string, ProxyDispatcher>();

export type ProxyProtocol = "socks5" | "http";

export interface ParsedProxy {
  protocol: ProxyProtocol;

  href: string;

  label: string;
  hasAuth: boolean;
}

export function parseProxyUrl(raw: string | undefined | null): ParsedProxy | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`Invalid proxy URL: ${trimmed}`);
  }

  const scheme = url.protocol.replace(/:$/, "").toLowerCase();
  let protocol: ProxyProtocol;
  let href = trimmed;

  if (scheme === "socks5" || scheme === "socks5h") {
    protocol = "socks5";

    href = trimmed.replace(/^socks5h:/i, "socks5:");
    url = new URL(href);
  } else if (scheme === "socks" || scheme === "socks4" || scheme === "socks4a") {
    if (scheme !== "socks") {
      throw new Error(`Unsupported proxy protocol: ${scheme} (use socks5://)`);
    }
    protocol = "socks5";
  } else if (scheme === "http" || scheme === "https") {
    protocol = "http";
  } else {
    throw new Error(`Unsupported proxy protocol: ${scheme} (use socks5:// or http://)`);
  }

  if (!url.hostname) throw new Error(`Proxy URL is missing a host: ${trimmed}`);

  return {
    protocol,
    href,
    label: `${url.hostname}:${url.port || (protocol === "socks5" ? "1080" : "80")}`,
    hasAuth: Boolean(url.username || url.password),
  };
}

export function dispatcherFor(proxyUrl: string | undefined | null): ProxyDispatcher | undefined {
  const parsed = parseProxyUrl(proxyUrl);
  if (!parsed) return undefined;

  const cached = dispatcherCache.get(parsed.href);
  if (cached) return cached;

  const dispatcher =
    parsed.protocol === "socks5" ? new Socks5ProxyAgent(parsed.href) : new ProxyAgent(parsed.href);

  dispatcherCache.set(parsed.href, dispatcher);
  return dispatcher;
}

export function providerProxyDispatcher(proxyUrl: string): ProxyDispatcher | undefined {
  return dispatcherFor(proxyUrl);
}

export function proxyLabel(proxyUrl: string | undefined | null): string | undefined {
  try {
    return parseProxyUrl(proxyUrl)?.label;
  } catch {
    return undefined;
  }
}

export async function closeProxyDispatchers(): Promise<void> {
  const dispatchers = [...dispatcherCache.values()];
  dispatcherCache.clear();
  await Promise.all(
    dispatchers.map(async (dispatcher) => {
      try {
        await dispatcher.close();
      } catch {}
    }),
  );
}
