import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import type { ProviderCatalogEntry, ProviderStatus } from "../types.js";
import { ConnectProviderModal } from "../components/ConnectProviderModal.js";
import { ProviderCard } from "../components/ProviderCard.js";
import { Empty, Panel } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";

/**
 * The catalog browser.
 *
 * Providers are chosen by clicking a card — the user never types a base URL or
 * an auth scheme. Free and billed providers are shown in separate sections.
 */
export function Providers({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const toast = useToast();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [custom, setCustom] = useState<ProviderCatalogEntry[]>([]);
  const [query, setQuery] = useState("");
  const [connecting, setConnecting] = useState<ProviderStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, endpoints] = await Promise.all([api.providers(), api.customEndpoints()]);
      setProviders(list);
      setCustom(endpoints);
    } catch (error) {
      toast.err(error instanceof Error ? error.message : String(error));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return providers;
    return providers.filter((provider) =>
      [provider.id, provider.displayName, provider.freeTier.summary, ...provider.knownModels].some(
        (field) => field.toLowerCase().includes(needle),
      ),
    );
  }, [providers, query]);

  const free = filtered.filter((provider) => provider.freeTier.advertised);
  const other = filtered.filter((provider) => !provider.freeTier.advertised);

  return (
    <>
      <Panel
        title="Provider catalog"
        actions={
          <input
            className="search"
            value={query}
            placeholder="Search providers or models…"
            onChange={(event) => setQuery(event.target.value)}
          />
        }
      >
        <div className="hint-box" style={{ marginBottom: 16 }}>
          A “Free” badge means the provider itself advertises a free tier. Everything COKEY ships is
          free-tier friendly; paid-only models are never listed.
        </div>

        <h3 style={{ fontSize: 13, margin: "0 0 10px" }}>
          ★ Free providers ({free.length})
        </h3>
        {free.length === 0 ? (
          <Empty>No free providers match “{query}”.</Empty>
        ) : (
          <div className="grid cards">
            {free.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} onConnect={setConnecting} />
            ))}
          </div>
        )}

        {other.length > 0 ? (
          <>
            <h3 style={{ fontSize: 13, margin: "22px 0 10px" }}>Other supported providers</h3>
            <div className="grid cards">
              {other.map((provider) => (
                <ProviderCard key={provider.id} provider={provider} onConnect={setConnecting} />
              ))}
            </div>
          </>
        ) : null}
      </Panel>

      <Panel title={`Custom endpoints (${custom.length})`}>
        {custom.length === 0 ? (
          <Empty>
            None configured. Custom OpenAI-compatible endpoints are added from the Settings tab and are
            validated against the SSRF guard.
          </Empty>
        ) : (
          <div className="grid cards">
            {custom.map((endpoint) => (
              <div key={endpoint.id} className="card">
                <div className="title">{endpoint.displayName}</div>
                <div className="sub mono" style={{ overflowWrap: "anywhere" }}>
                  {endpoint.baseUrl}
                </div>
                <div className="sub faint">
                  {endpoint.knownModels.length} models · {endpoint.apiStyle} · {endpoint.authScheme}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {connecting ? (
        <ConnectProviderModal
          provider={connecting}
          onClose={() => setConnecting(null)}
          onConnected={() => {
            void load();
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}
