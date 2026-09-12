import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api.js";
import type {
  CatalogProviderRow,
  ProviderCatalogEntry,
  ProviderDossier,
  ProviderStatus,
} from "../types.js";
import { ConnectProviderModal } from "../components/ConnectProviderModal.js";
import { Pagination } from "../components/Pagination.js";
import { Empty, Panel } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";
import { queryParam, useRoute } from "../router.js";

const VERDICT_ORDER: ProviderDossier["verdict"][] = ["recommended", "usable", "limited", "avoid"];

const VERDICT_LABEL: Record<ProviderDossier["verdict"], string> = {
  recommended: "Recommended",
  usable: "Usable",
  limited: "Limited",
  avoid: "Avoid",
};

const VERDICT_TONE: Record<ProviderDossier["verdict"], string> = {
  recommended: "",
  usable: "neutral",
  limited: "warn",
  avoid: "bad",
};

const KIND_LABEL: Record<ProviderDossier["kind"], string> = {
  lab: "Model lab",
  "inference-cloud": "Inference cloud",
  aggregator: "Aggregator",
  gateway: "Gateway",
  local: "Local runtime",
};

/**
 * The provider browser.
 *
 * A card answers the two questions a catalogue normally dodges: who runs this
 * and from where, and is it worth depending on. Providers are grouped by
 * verdict rather than alphabetically, because "recommended" is the only ordering
 * a person actually needs when picking their first three keys.
 */
export function Providers({
  refreshKey,
  onChanged,
}: {
  refreshKey: number;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<CatalogProviderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { route } = useRoute();
  const [query, setQuery] = useState(queryParam(route.query, "q") ?? "");
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [connecting, setConnecting] = useState<ProviderStatus | null>(null);
  const [custom, setCustom] = useState<ProviderCatalogEntry[]>([]);

  const load = useCallback(async () => {
    try {
      const [catalog, endpoints] = await Promise.all([
        api.catalogProviders({ page, pageSize, q: query }),
        api.customEndpoints(),
      ]);
      setRows(catalog.data);
      setTotal(catalog.total);
      setTotalPages(catalog.totalPages);
      setCustom(endpoints);
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }, [page, pageSize, query, toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const visible = connectedOnly ? rows.filter((row) => row.connected) : rows;

  return (
    <>
      <Panel
        title={`Provider catalog (${total})`}
        actions={
          <div className="row" style={{ gap: 8 }}>
            <label className="small muted row" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={connectedOnly}
                style={{ width: "auto" }}
                onChange={(event) => setConnectedOnly(event.target.checked)}
              />
              connected only
            </label>
            <input
              className="search"
              value={query}
              placeholder="Search name, operator or country"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
        }
      >
        <div className="hint-box" style={{ marginBottom: 16 }}>
          A large part of this list is one underlying free pool re-exported under several names. The
          verdict reflects that: start with the recommended tier, and treat anything marked avoid as
          a provider you should not build on. The full reasoning is in the Models, Rankings tab.
        </div>

        {visible.length === 0 ? (
          <Empty>No providers match that search.</Empty>
        ) : (
          VERDICT_ORDER.map((verdict) => {
            const group = visible.filter((row) => row.dossier.verdict === verdict);
            if (group.length === 0) return null;
            return (
              <section key={verdict} className="provider-section">
                <h3 className="provider-section-title">
                  {VERDICT_LABEL[verdict]}
                  <span className="badge neutral">{group.length}</span>
                </h3>
                <div className="grid cards">
                  {group.map((row) => (
                    <ProviderDossierCard key={row.id} row={row} onConnect={setConnecting} />
                  ))}
                </div>
              </section>
            );
          })
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          noun="providers"
          onChange={(params) => {
            if (params.page) setPage(params.page);
            if (params.pageSize) {
              setPageSize(params.pageSize);
              setPage(1);
            }
          }}
        />
      </Panel>

      <Panel title={`Custom endpoints (${custom.length})`}>
        {custom.length === 0 ? (
          <Empty>
            None configured. Add one from Settings, custom endpoints are validated against the SSRF
            guard before they are stored.
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

/** One provider card: identity, jurisdiction, verdict and connection state. */
function ProviderDossierCard({
  row,
  onConnect,
}: {
  row: CatalogProviderRow;
  onConnect: (provider: ProviderStatus) => void;
}) {
  const dossier = row.dossier;
  const [showModels, setShowModels] = useState(false);
  const credentialLabel = row.credentialFields.includes("accountId")
    ? "API token and account id"
    : "API key";

  return (
    <div className="card provider-card">
      <div className="title">
        {row.displayName}
        {row.freeTier.advertised ? (
          <span className="badge">Free</span>
        ) : (
          <span className="badge neutral">Billed</span>
        )}
        <span className={`badge ${VERDICT_TONE[dossier.verdict]}`}>{dossier.verdict}</span>
      </div>

      <div className="sub">{dossier.summary}</div>

      <dl className="dossier">
        <div>
          <dt>Operator</dt>
          <dd>{dossier.operator}</dd>
        </div>
        <div>
          <dt>Based in</dt>
          <dd>{dossier.origin}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{KIND_LABEL[dossier.kind]}</dd>
        </div>
        <div>
          <dt>Free tier</dt>
          <dd>{row.freeTier.summary}</dd>
        </div>
        <div>
          <dt>Credential</dt>
          <dd>
            {credentialLabel} · {row.knownModels.length} curated model(s)
          </dd>
        </div>
      </dl>

      <div className="sub faint">{dossier.verdictReason}</div>
      {row.notes ? <div className="sub faint">{row.notes}</div> : null}

      <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={() => onConnect(row)}>Connect</button>
        <button
          className="secondary"
          type="button"
          aria-expanded={showModels}
          onClick={() => setShowModels((value) => !value)}
        >
          {showModels ? "Hide models" : `Show models (${row.knownModels.length})`}
        </button>
        {dossier.sourceUrl ? (
          <a className="small" href={dossier.sourceUrl} target="_blank" rel="noreferrer">
            source
          </a>
        ) : null}
        {row.signupUrl ? (
          <a className="small" href={row.signupUrl} target="_blank" rel="noreferrer">
            get a free key
          </a>
        ) : null}
        <span className="spacer" />
        <span className="small faint">
          {row.connected ? `${row.credentialCount} connected` : "not connected"}
        </span>
      </div>

      {showModels ? (
        <div className="model-list">
          {row.knownModels.length === 0 ? (
            <div className="sub faint">No curated models for this provider.</div>
          ) : (
            row.knownModels.map((model) => (
              <div className="model-list-item" key={model}>
                <span className="model-list-id">{model}</span>
                <span className="spacer" />
                <a
                  className="small"
                  href={`#/chains?model=${encodeURIComponent(model)}&provider=${encodeURIComponent(
                    row.id,
                  )}`}
                >
                  add to chain
                </a>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
