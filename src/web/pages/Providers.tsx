import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, timeAgo } from "../api.js";
import type {
  CatalogProviderRow,
  ModelCatalogView,
  ProviderCatalogEntry,
  ProviderDossier,
  ProviderStatus,
} from "../types.js";
import { ConnectProviderModal } from "../components/ConnectProviderModal.js";
import { Pagination } from "../components/Pagination.js";
import { Empty, Modal, Panel } from "../components/Primitives.js";
import { IconGrid } from "../components/Icons.js";
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
  /**
   * The observed model inventory, joined onto the cards.
   *
   * Fetched from the same `/api/models` the Models screen uses rather than
   * duplicated onto the provider row, so there is one source of truth for what a
   * provider serves and the two screens can never disagree.
   */
  const [inventory, setInventory] = useState<Map<string, ModelCatalogView>>(new Map());
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [catalog, endpoints, models] = await Promise.all([
        api.catalogProviders({ page, pageSize, q: query }),
        api.customEndpoints(),
        api.models(),
      ]);
      setRows(catalog.data);
      setTotal(catalog.total);
      setTotalPages(catalog.totalPages);
      setCustom(endpoints);
      setInventory(new Map(models.providers.map((view) => [view.providerId, view])));
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }, [page, pageSize, query, toast]);

  /** Ask one provider what it serves now, and report what changed. */
  const refreshModels = useCallback(
    async (providerId: string, displayName: string) => {
      setRefreshing(providerId);
      try {
        const report = await api.refreshProviderModels(providerId);
        if (!report.ok) {
          toast.err(report.message ?? `${displayName} could not be checked`);
        } else {
          const parts = [
            report.added.length ? `${report.added.length} new` : "",
            report.restored.length ? `${report.restored.length} restored` : "",
            report.removed.length ? `${report.removed.length} retired` : "",
          ].filter(Boolean);
          toast.ok(
            parts.length
              ? `${displayName}: ${parts.join(", ")} model(s)`
              : `${displayName} is unchanged (${report.discovered} models)`,
          );
        }
        await load();
        onChanged();
      } catch (error) {
        toast.err(error instanceof ApiError ? error.message : String(error));
      } finally {
        setRefreshing(null);
      }
    },
    [load, onChanged, toast],
  );

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const visible = connectedOnly ? rows.filter((row) => row.connected) : rows;

  return (
    <>
      <Panel
        hue="sky"
        icon={<IconGrid size={14} />}
        title={`Providers (${total})`}
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
              placeholder="Search providers"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
        }
      >
        <div className="hint-box" style={{ marginBottom: 16 }}>
          Much of this list is one free pool re-exported under several names, so the verdicts are
          the point: start at the top and never build on an <strong>avoid</strong>.
        </div>

        {visible.length === 0 ? (
          <Empty>Nothing matches.</Empty>
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
                    <ProviderDossierCard
                      key={row.id}
                      row={row}
                      inventory={inventory.get(row.id)}
                      refreshing={refreshing === row.id}
                      onConnect={setConnecting}
                      onRefreshModels={refreshModels}
                    />
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
            None yet — add one in Settings. URLs are SSRF-checked before they are stored.
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
  inventory,
  refreshing,
  onConnect,
  onRefreshModels,
}: {
  row: CatalogProviderRow;
  /** Observed model inventory, when this provider has ever been checked. */
  inventory?: ModelCatalogView;
  refreshing: boolean;
  onConnect: (provider: ProviderStatus) => void;
  onRefreshModels: (providerId: string, displayName: string) => void;
}) {
  const dossier = row.dossier;
  const [open, setOpen] = useState(false);
  const credentialLabel = row.credentialFields.includes("accountId")
    ? "API token and account id"
    : "API key";

  const stale = inventory?.staleModels ?? [];
  const staleSet = useMemo(() => new Set(stale), [stale]);
  const listedIds = useMemo(
    () => new Set(dossier.models?.length ? dossier.models.map((m) => m.id) : row.knownModels),
    [dossier.models, row.knownModels],
  );
  const unlistedStale = useMemo(
    () => stale.filter((model) => !listedIds.has(model)),
    [stale, listedIds],
  );
  const checkedAt = inventory?.inventoryCheckedAt;

  return (
    <div className="card provider-card">
      <div className="title">
        {row.displayName}
        <span className={`badge ${VERDICT_TONE[dossier.verdict]}`}>{dossier.verdict}</span>
        {/*
         * Where this opinion came from matters. A dossier read from the content
         * repository can be corrected without a release, so a reader who
         * disagrees with the verdict knows exactly which file to open.
         */}
        {dossier.source === "cms" ? (
          <span
            className="badge neutral"
            title={
              dossier.reviewedAt
                ? `Curated content, last reviewed ${dossier.reviewedAt}`
                : "Curated content"
            }
          >
            curated
          </span>
        ) : null}
        {stale.length > 0 ? (
          <span className="badge bad" title={`No longer returned: ${stale.slice(0, 6).join(", ")}`}>
            {stale.length} retired
          </span>
        ) : checkedAt ? (
          <span className="badge" title={`Model list checked ${timeAgo(checkedAt)}`}>
            live
          </span>
        ) : null}
      </div>

      <div className="sub">{dossier.summary}</div>

      {/*
       * The state that used to be invisible: whether this provider's model list
       * has ever been checked, and whether it has gone stale since.
       */}
      <div className="sub faint" style={{ marginTop: 4 }}>
        {checkedAt
          ? `model list checked ${timeAgo(checkedAt)}`
          : row.connected
            ? "model list never checked"
            : "connect a key to check"}
      </div>

      <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={() => onConnect(row)}>Connect</button>
        <button className="secondary" type="button" onClick={() => setOpen(true)}>
          Models ({row.knownModels.length})
        </button>
        <button
          className="secondary"
          type="button"
          disabled={!row.connected || refreshing}
          title={
            row.connected
              ? `Ask ${row.displayName} what it serves right now`
              : "Connect a key first"
          }
          onClick={() => onRefreshModels(row.id, row.displayName)}
        >
          {refreshing ? "checking…" : "re-check"}
        </button>
        <span className="spacer" />
        <span className="small faint">
          {row.connected
            ? `${row.credentialCount} key${row.credentialCount === 1 ? "" : "s"}`
            : "none"}
        </span>
      </div>

      {open ? (
        <Modal
          title={row.displayName}
          subtitle={`${dossier.operator} · ${dossier.origin}`}
          onClose={() => setOpen(false)}
          wide
        >
          <dl className="dossier">
            <div>
              <dt>Type</dt>
              <dd>{KIND_LABEL[dossier.kind]}</dd>
            </div>
            <div>
              <dt>Free tier</dt>
              {/* The content repository's own one-liner wins when it has one. */}
              <dd>{dossier.freeTierSummary ?? row.freeTier.summary}</dd>
            </div>
            <div>
              <dt>Credential</dt>
              <dd>
                {credentialLabel} · {row.knownModels.length} curated model(s)
              </dd>
            </div>
            {dossier.reviewedAt ? (
              <div>
                <dt>Reviewed</dt>
                <dd>{dossier.reviewedAt}</dd>
              </div>
            ) : null}
          </dl>

          <p className="small faint" style={{ marginTop: 0 }}>
            {dossier.verdictReason}
          </p>
          {dossier.notes ? <p className="small faint">{dossier.notes}</p> : null}
          {row.notes ? <p className="small faint">{row.notes}</p> : null}

          {/*
           * The content repository's model list carries what a name alone cannot:
           * context window, what the model is good at, and measured latency. When
           * it exists it is the better list, and the catalog's is the fallback.
           *
           * Neither list is trustworthy on its own about which of its entries
           * the provider still actually serves — that only comes from the last
           * live check (`stale`). A retired model stays visible, so a reader
           * can still see what it was, but greyed out with no way to add it to
           * a chain: the whole point of checking model lists is to stop a
           * chain being built against a model that is already gone.
           */}
          {dossier.models && dossier.models.length > 0 ? (
            <div className="model-list">
              {dossier.models.map((model) => {
                const retired = staleSet.has(model.id);
                return (
                  <div className={`model-list-item${retired ? " retired" : ""}`} key={model.id}>
                    <span className="model-list-id">{model.id}</span>
                    <span className="small faint">
                      {[model.context, model.bestFor].filter(Boolean).join(" · ")}
                    </span>
                    <span className="spacer" />
                    {retired ? (
                      <span className="badge bad">retired</span>
                    ) : (
                      <>
                        {model.latencySeconds ? (
                          <span className="small faint">{model.latencySeconds}s</span>
                        ) : null}
                        <a
                          className="small"
                          href={`#/chains?model=${encodeURIComponent(
                            model.id,
                          )}&provider=${encodeURIComponent(row.id)}`}
                        >
                          add to chain
                        </a>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="model-list">
              {row.knownModels.length === 0 ? (
                <div className="sub faint">No curated models.</div>
              ) : (
                row.knownModels.map((model) => {
                  const retired = staleSet.has(model);
                  return (
                    <div className={`model-list-item${retired ? " retired" : ""}`} key={model}>
                      <span className="model-list-id">{model}</span>
                      <span className="spacer" />
                      {retired ? (
                        <span className="badge bad">retired</span>
                      ) : (
                        <a
                          className="small"
                          href={`#/chains?model=${encodeURIComponent(
                            model,
                          )}&provider=${encodeURIComponent(row.id)}`}
                        >
                          add to chain
                        </a>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/*
           * Retired models the content repository never described in the
           * first place — the ones above already carry their own "retired"
           * badge inline, so this only needs to cover the gap.
           */}
          {unlistedStale.length > 0 ? (
            <div className="model-list">
              <div className="small faint">
                Retired · gone since {timeAgo(checkedAt ?? Date.now())}
              </div>
              {unlistedStale.map((model) => (
                <div className="model-list-item retired" key={model}>
                  <span className="model-list-id">{model}</span>
                  <span className="spacer" />
                  <span className="badge bad">retired</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="modal-actions">
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
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
