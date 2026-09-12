import { ProxyAgent, Socks5ProxyAgent } from "undici";

/**
 * Per-credential egress.
 *
 * Rotating API keys across accounts from a single IP still trips provider rate
 * limits, because the limit is usually tracked per IP *and* per key. Binding a
 * distinct proxy to each credential is what makes a pool of keys from the same
 * provider genuinely independent: one key, one exit IP.
 *
 * Both SOCKS5 (`socks5://`, `socks://`) and plain HTTP CONNECT proxies
 * (`http://`, `https://`) are supported. Dispatchers are cached by URL so a
 * busy gateway does not build a new connection pool per request.
 */
/**
 * Opaque handle to an undici dispatcher.
 *
 * Typed structurally rather than as `undici.Dispatcher` because `@types/node`
 * bundles its own copy of the undici types, and the two declarations are not
 * assignment-compatible with each other.
 */
export interface ProxyDispatcher {
  close(): Promise<void>;
}

const dispatcherCache = new Map<string, ProxyDispatcher>();

export type ProxyProtocol = "socks5" | "http";

export interface ParsedProxy {
  protocol: ProxyProtocol;
  /** Normalised URL handed to undici. */
  href: string;
  /** `host:port` with any credentials stripped. Safe to log and display. */
  label: string;
  hasAuth: boolean;
}

/**
 * Validate and normalise a proxy URL.
 *
 * Returns `undefined` for an empty value, and throws for anything that is not a
 * supported proxy URL so a typo surfaces at configuration time rather than as a
 * confusing network error on the next request.
 */
export function parseProxyUrl(
  raw: string | undefined | null,
): ParsedProxy | undefined {
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
    // Force the exact scheme undici's SOCKS5 agent expects.
    href = trimmed.replace(/^socks5h:/i, "socks5:");
    url = new URL(href);
  } else if (scheme === "socks" || scheme === "socks4" || scheme === "socks4a") {
    // SOCKS4 has no authentication and is not supported by undici.
    if (scheme !== "socks") {
      throw new Error(
        `Unsupported proxy protocol: ${scheme} (use socks5://)`,
      );
    }
    protocol = "socks5";
  } else if (scheme === "http" || scheme === "https") {
    protocol = "http";
  } else {
    throw new Error(
      `Unsupported proxy protocol: ${scheme} (use socks5:// or http://)`,
    );
  }

  if (!url.hostname)
    throw new Error(`Proxy URL is missing a host: ${trimmed}`);

  return {
    protocol,
    href,
    label: `${url.hostname}:${url.port || (protocol === "socks5" ? "1080" : "80")}`,
    hasAuth: Boolean(url.username || url.password),
  };
}

/**
 * Build (or reuse) the dispatcher for a proxy URL.
 *
 * Returns `undefined` when no proxy is configured, which tells the caller to
 * use the process default - direct egress.
 */
export function dispatcherFor(
  proxyUrl: string | undefined | null,
): ProxyDispatcher | undefined {
  const parsed = parseProxyUrl(proxyUrl);
  if (!parsed) return undefined;

  const cached = dispatcherCache.get(parsed.href);
  if (cached) return cached;

  const dispatcher =
    parsed.protocol === "socks5"
      ? new Socks5ProxyAgent(parsed.href)
      : new ProxyAgent(parsed.href);

  dispatcherCache.set(parsed.href, dispatcher);
  return dispatcher;
}

/**
 * Build (or reuse) the dispatcher for a provider-level automatic proxy.
 *
 * When the proxy pool hands out an address, this is the function that turns the
 * address into a cached undici dispatcher. It is exported separately so the
 * provider proxy layer can keep per-address caching consistent with the rest of
 * the gateway.
 */
export function providerProxyDispatcher(
  proxyUrl: string,
): ProxyDispatcher | undefined {
  return dispatcherFor(proxyUrl);
}

/** `host:port` of a proxy URL, or `undefined`. Never includes credentials. */
export function proxyLabel(
  proxyUrl: string | undefined | null,
): string | undefined {
  try {
    return parseProxyUrl(proxyUrl)?.label;
  } catch {
    return undefined;
  }
}

/**
 * Release every pooled connection. Used by tests and graceful shutdown.
 */
export async function closeProxyDispatchers(): Promise<void> {
  const dispatchers = [...dispatcherCache.values()];
  dispatcherCache.clear();
  await Promise.all(
    dispatchers.map(async (dispatcher) => {
      try {
        await dispatcher.close();
      } catch {
        // A dispatcher that never opened a connection throws on close.
      }
    }),
  );
}
