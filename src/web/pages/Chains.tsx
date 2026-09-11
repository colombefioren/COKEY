import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ChainView } from "../types.js";
import { ChainCard } from "../components/ChainCard.js";
import { Empty, Panel } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";

export function Chains({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const toast = useToast();
  const [chains, setChains] = useState<ChainView[]>([]);
  const [alias, setAlias] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setChains(await api.chains());
    } catch (error) {
      toast.err(error instanceof Error ? error.message : String(error));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function createChain() {
    const name = alias.trim();
    if (!name) {
      toast.err("Give the chain an alias, e.g. cokey-best");
      return;
    }
    setBusy(true);
    try {
      await api.createChain({ alias: name, description: description.trim() || undefined });
      setAlias("");
      setDescription("");
      toast.ok(`Created ${name}`);
      await load();
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel title="New chain">
        <div className="row wrap">
          <div style={{ flex: "1 1 260px" }}>
            <label htmlFor="chain-alias">Alias (this is the model id clients send)</label>
            <input
              id="chain-alias"
              value={alias}
              placeholder="cokey-best"
              onChange={(event) => setAlias(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void createChain();
              }}
            />
          </div>
          <div style={{ flex: "2 1 320px" }}>
            <label htmlFor="chain-description">Description (optional)</label>
            <input
              id="chain-description"
              value={description}
              placeholder="Groq primary, OpenRouter failover"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <button onClick={() => void createChain()} disabled={busy} style={{ alignSelf: "flex-end" }}>
            {busy ? "Creating…" : "Create chain"}
          </button>
        </div>
      </Panel>

      <Panel title={`Chains (${chains.length})`}>
        {chains.length === 0 ? (
          <Empty>No chains yet. Create one above, then add provider entries.</Empty>
        ) : (
          chains.map((chain) => (
            <ChainCard
              key={chain.id}
              chain={chain}
              onChanged={() => {
                void load();
                onChanged();
              }}
            />
          ))
        )}
      </Panel>

      <div className="hint-box">
        Routing order is yours: an entry only runs after every credential above it has been tried.
        Drag a row, press <code>Alt+↑</code> / <code>Alt+↓</code>, or use the arrow buttons.
      </div>
    </>
  );
}
