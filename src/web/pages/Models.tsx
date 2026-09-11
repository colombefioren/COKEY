import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ChainView, ModelCatalogView, ModelsResponse, SelectableModel } from "../types.js";
import { Empty, Modal, Panel } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";

interface Pick {
  provider: ModelCatalogView;
  model: SelectableModel;
}

/**
 * The free-model catalog.
 *
 * Every model a provider currently serves for free is listed, but a model is
 * only *clickable* when its provider has at least one key COKEY has verified.
 * That is the honesty rule: the catalog shows what exists, the action bar shows
 * what actually works, and the gap between them is a signup link — never a
 * chain entry that cannot run.
 */
export function Models({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<ModelsResponse | null>(null);
  const [chains, setChains] = useState<ChainView[]>([]);
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [catalog, chainList] = await Promise.all([api.models(), api.chains()]);
        if (cancelled) return;
        setData(catalog);
        setChains(chainList);
      } catch (error) {
        if (!cancelled) toast.err(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, toast]);

  const providers = useMemo(() => {
    const all = data?.providers ?? [];
    const needle = query.trim().toLowerCase();
    return all
      .filter((provider) => (availableOnly ? provider.available : true))
      .map((provider) => ({
        ...provider,
        models: needle
          ? provider.models.filter(
              (model) =>
                model.id.toLowerCase().includes(needle) ||
                (model.bestFor ?? "").toLowerCase().includes(needle) ||
                provider.displayName.toLowerCase().includes(needle),
            )
          : provider.models,
      }))
      .filter((provider) => provider.models.length > 0);
  }, [data, query, availableOnly]);

  async function addToChain(chainId: string, target: Pick) {
    setBusy(true);
    try {
      await api.addEntry(chainId, {
        providerId: target.provider.providerId,
        model: target.model.id,
        // Availability already guaranteed at least one healthy key; wire them
        // all in so failover works without a second manual step.
        credentialIds: target.provider.credentialIds,
      });
      const chain = chains.find((candidate) => candidate.id === chainId);
      toast.ok(`Added ${target.model.id} to ${chain?.alias ?? "chain"}`);
      setPick(null);
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function addToNewChain(alias: string, target: Pick) {
    setBusy(true);
    try {
      const chain = await api.createChain({ alias });
      await api.addEntry(chain.id, {
        providerId: target.provider.providerId,
        model: target.model.id,
        credentialIds: target.provider.credentialIds,
      });
      toast.ok(`Created ${chain.alias} with ${target.model.id}`);
      setPick(null);
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const availableProviders = data?.providers.filter((provider) => provider.available).length ?? 0;

  return (
    <Panel
      title={`Free model catalog (${data?.total ?? 0} models)`}
      actions={
        <div className="row" style={{ gap: 8 }}>
          <label className="small muted row" style={{ gap: 6 }}>
            <input
              type="checkbox"
              checked={availableOnly}
              style={{ width: "auto" }}
              onChange={(event) => setAvailableOnly(event.target.checked)}
            />
            usable only
          </label>
          <input
            className="search"
            placeholder="Search model, use or provider…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      }
    >
      <p className="small muted" style={{ marginTop: 0 }}>
        {availableProviders} of {data?.providers.length ?? 0} providers have a working key. Greyed models
        become clickable as soon as you connect a key for their provider — COKEY never adds a model it
        cannot route.
      </p>

      {providers.length === 0 ? <Empty>No models match that search.</Empty> : null}

      <div className="model-providers">
        {providers.map((provider) => (
          <section key={provider.providerId} className="model-provider">
            <header>
              <span className={`dot ${provider.available ? "healthy" : "unverified"}`} />
              <strong>{provider.displayName}</strong>
              <span className="small faint">{provider.freeTier.summary}</span>
              <span className="spacer" />
              {provider.available ? (
                <span className="badge">
                  {provider.healthyCount} key{provider.healthyCount === 1 ? "" : "s"}
                </span>
              ) : provider.credentialCount > 0 ? (
                <span className="badge warn">keys unhealthy</span>
              ) : (
                <a className="small" href={provider.signupUrl} target="_blank" rel="noreferrer">
                  get a free key ↗
                </a>
              )}
            </header>

            <div className="model-grid">
              {provider.models.map((model) => {
                const selectable = provider.available && model.selectable;
                return (
                  <button
                    key={`${provider.providerId}/${model.id}`}
                    type="button"
                    className={`model-chip ${selectable ? "" : "locked"}`}
                    disabled={!selectable}
                    title={
                      selectable
                        ? `Add ${model.id} to a chain`
                        : `Connect a working ${provider.displayName} key to use ${model.id}`
                    }
                    onClick={() => setPick({ provider, model })}
                  >
                    <span className="model-id mono">{model.id}</span>
                    <span className="model-meta small faint">
                      {model.context ? <span>{model.context} ctx</span> : null}
                      {model.bestFor ? <span>{model.bestFor}</span> : null}
                      {model.latencySeconds !== undefined ? (
                        <span>{model.latencySeconds}s</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {pick ? (
        <ModelPicker
          target={pick}
          chains={chains}
          busy={busy}
          onClose={() => setPick(null)}
          onAdd={addToChain}
          onCreate={addToNewChain}
        />
      ) : null}
    </Panel>
  );
}

/** Choose which chain a clicked model becomes an entry of. */
function ModelPicker({
  target,
  chains,
  busy,
  onClose,
  onAdd,
  onCreate,
}: {
  target: Pick;
  chains: ChainView[];
  busy: boolean;
  onClose: () => void;
  onAdd: (chainId: string, target: Pick) => Promise<void>;
  onCreate: (alias: string, target: Pick) => Promise<void>;
}) {
  const [chainId, setChainId] = useState(chains[0]?.id ?? "");
  const [alias, setAlias] = useState("");

  return (
    <Modal
      title={target.model.id}
      subtitle={`${target.provider.displayName} · ${target.model.context ?? "context unknown"} · ${
        target.model.bestFor ?? "general"
      }`}
      onClose={onClose}
    >
      {chains.length > 0 ? (
        <>
          <label className="field">
            <span>Add to chain</span>
            <select value={chainId} onChange={(event) => setChainId(event.target.value)}>
              {chains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.alias} ({chain.entries.length} entries)
                </option>
              ))}
            </select>
          </label>
          <div className="modal-actions">
            <button className="secondary" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              disabled={!chainId || busy}
              onClick={() => void onAdd(chainId, target)}
              type="button"
            >
              {busy ? "Adding…" : "Add entry"}
            </button>
          </div>
          <div className="small faint" style={{ marginTop: 10 }}>
            All {target.provider.credentialIds.length} working key(s) for this provider are attached, so
            fallback works immediately.
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span>New chain alias</span>
            <input
              placeholder="cokey-best"
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
            />
          </label>
          <div className="modal-actions">
            <button className="secondary" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              disabled={!alias.trim() || busy}
              onClick={() => void onCreate(alias.trim(), target)}
              type="button"
            >
              {busy ? "Creating…" : "Create chain"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
