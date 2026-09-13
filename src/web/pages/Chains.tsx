import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ChainView, ProviderStatus } from "../types.js";
import { ChainCard } from "../components/ChainCard.js";
import { Pagination } from "../components/Pagination.js";
import { Empty, Panel } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";
import { useRoute } from "../router.js";
import { Keys } from "./Keys.js";

const CHAINS_PER_PAGE = 10;

/**
 * Chains are the whole product, so everything about them lives on one screen:
 * create, order, and the keys each node can use.
 *
 * There is no separate "add chain" page any more. Adding a node reuses the
 * existing chain, and the Keys tab is the credential inventory filtered to the
 * chains you actually run.
 */
export function Chains({
  refreshKey,
  onChanged,
  providers,
}: {
  refreshKey: number;
  onChanged: () => void;
  providers: ProviderStatus[];
}) {
  const { route, navigate } = useRoute();
  const tab = route.section === "keys" ? "keys" : "nodes";

  return (
    <>
      <div className="tabs tabs-inline">
        <button
          type="button"
          className="tab"
          aria-selected={tab === "nodes"}
          onClick={() => navigate("/chains")}
        >
          Chains and nodes
        </button>
        <button
          type="button"
          className="tab"
          aria-selected={tab === "keys"}
          onClick={() => navigate("/chains/keys")}
        >
          Keys
        </button>
      </div>

      {tab === "keys" ? (
        <Keys refreshKey={refreshKey} onChanged={onChanged} providers={providers} />
      ) : (
        <ChainList refreshKey={refreshKey} onChanged={onChanged} />
      )}
    </>
  );
}

function ChainList({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const toast = useToast();
  const [chains, setChains] = useState<ChainView[]>([]);
  const [alias, setAlias] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(CHAINS_PER_PAGE);

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

  const totalPages = Math.max(1, Math.ceil(chains.length / pageSize));
  const current = Math.min(page, totalPages);
  const visible = chains.slice((current - 1) * pageSize, current * pageSize);

  const totals = useMemo(() => {
    const nodes = chains.reduce((sum, chain) => sum + chain.entries.length, 0);
    const keys = chains.reduce(
      (sum, chain) =>
        sum + chain.entries.reduce((entrySum, entry) => entrySum + entry.credentials.length, 0),
      0,
    );
    return { nodes, keys };
  }, [chains]);

  async function createChain() {
    const name = alias.trim();
    if (!name) {
      toast.err("Give the chain an alias, for example cokey-best");
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
          <div style={{ flex: "1 1 240px" }}>
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
              placeholder="Groq primary, Cloudflare failover"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <button
            onClick={() => void createChain()}
            disabled={busy}
            style={{ alignSelf: "flex-end" }}
          >
            {busy ? "Creating…" : "Create chain"}
          </button>
        </div>
        <div className="small faint" style={{ marginTop: 8 }}>
          Routing order is yours. A node only runs after every key of the node above it has been
          tried. Drag a row, press <code>Alt+Up</code> / <code>Alt+Down</code>, or use the arrow
          buttons.
        </div>
      </Panel>

      <Panel title={`Chains (${chains.length})`}>
        <div className="row" style={{ marginBottom: 12, gap: 14 }}>
          <span className="small faint">{totals.nodes} nodes</span>
          <span className="small faint">{totals.keys} key bindings</span>
        </div>

        {chains.length === 0 ? (
          <Empty>No chains yet. Create one above, then add provider nodes to it.</Empty>
        ) : (
          visible.map((chain) => (
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

        <Pagination
          page={current}
          totalPages={totalPages}
          total={chains.length}
          pageSize={pageSize}
          noun="chains"
          onChange={(params) => {
            if (params.page) setPage(params.page);
            if (params.pageSize) {
              setPageSize(params.pageSize);
              setPage(1);
            }
          }}
        />
      </Panel>
    </>
  );
}
