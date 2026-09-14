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
import { IconZap } from "../components/Icons.js";
import { Pagination } from "../components/Pagination.js";
import { Empty, Modal, Panel } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";
import { queryParam, useRoute } from "../router.js";
import { useLang } from "../lang.js";

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
  const { t } = useLang();
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
          toast.err(report.message ?? `${displayName} ${t("could not be checked")}`);
        } else {
          const parts = [
            report.added.length ? `${report.added.length} ${t("new")}` : "",
            report.restored.length ? `${report.restored.length} ${t("restored")}` : "",
            report.removed.length ? `${report.removed.length} ${t("retired")}` : "",
          ].filter(Boolean);
          toast.ok(
            parts.length
              ? `${displayName}: ${parts.join(", ")} ${t("model(s)")}`
              : `${displayName} ${t("is unchanged")} (${report.discovered} ${t("models")})`,
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
        title={`${t("Providers")} (${total})`}
        actions={
          <div className="row" style={{ gap: 8 }}>
            <label className="small muted row" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={connectedOnly}
                style={{ width: "auto" }}
                onChange={(event) => setConnectedOnly(event.target.checked)}
              />
              {t("connected only")}
            </label>
            <input
              className="search"
              data-tour="providers-search"
              value={query}
              placeholder={t("Search providers")}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
        }
      >
        <div className="hint-box" style={{ marginBottom: 16 }}>
          {t(
            "Much of this list is one free pool re-exported under several names, so the verdicts are the point: start at the top and never build on an",
          )}{" "}
          <strong>{t("avoid")}</strong>.
        </div>

        {visible.length === 0 ? (
          <Empty>{t("Nothing matches.")}</Empty>
        ) : (
          VERDICT_ORDER.map((verdict) => {
            const group = visible.filter((row) => row.dossier.verdict === verdict);
            if (group.length === 0) return null;
            return (
              <section key={verdict} className="provider-section">
                <h3 className="provider-section-title">
                  {t(VERDICT_LABEL[verdict])}
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

      <Panel title={`${t("Custom endpoints")} (${custom.length})`}>
        {custom.length === 0 ? (
          <Empty>
            {t("None yet — add one in Settings. URLs are SSRF-checked before they are stored.")}
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
                  {endpoint.knownModels.length} {t("models")} · {endpoint.apiStyle} ·{" "}
                  {endpoint.authScheme}
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
  const { t } = useLang();
  const dossier = row.dossier;
  const [open, setOpen] = useState(false);
  const credentialLabel = row.credentialFields.includes("accountId")
    ? t("API token and account id")
    : t("API key");

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
    <div
      className="card provider-card clickable"
      role="button"
      tabIndex={0}
      onClick={() => setOpen(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setOpen(true);
        }
      }}
    >
      <div className="title">
        {row.displayName}
        <span className={`badge ${VERDICT_TONE[dossier.verdict]}`}>{t(dossier.verdict)}</span>
        {dossier.reviewedAt ? (
          <span className="badge neutral" title={`${t("Reviewed")} ${dossier.reviewedAt}`}>
            {t("reviewed")}
          </span>
        ) : null}
        {stale.length > 0 ? (
          <span
            className="badge bad"
            title={`${t("No longer returned:")} ${stale.slice(0, 6).join(", ")}`}
          >
            {stale.length} {t("retired")}
          </span>
        ) : checkedAt ? (
          <span className="badge" title={`${t("Model list checked")} ${timeAgo(checkedAt)}`}>
            {t("live")}
          </span>
        ) : null}
      </div>

      <div className="sub clamp-2">{t(dossier.summary)}</div>

      {/*
       * The number that actually decides whether this provider is worth a
       * click, right on the card - not two clicks deep in the model-list
       * modal. Tone follows whether the provider itself published the
       * number: an operator's own figure reads as a confident chip, a gap in
       * their docs reads as the same honest "we don't know" as the rest of
       * the app uses for an unpublished rate limit.
       */}
      <div
        className={`quota-chip${row.freeTier.quotaSource === "unknown" ? " unknown" : ""}`}
        title={
          row.freeTier.quotaSource === "unknown"
            ? t("This provider does not publish its free-tier limits.")
            : t("Published by the provider.")
        }
      >
        <IconZap size={12} />
        <span>{t(dossier.freeTierSummary ?? row.freeTier.summary)}</span>
      </div>

      {/*
       * The state that used to be invisible: whether this provider's model list
       * has ever been checked, and whether it has gone stale since.
       */}
      <div className="sub faint" style={{ marginTop: 4 }}>
        {checkedAt
          ? `${t("model list checked")} ${timeAgo(checkedAt)}`
          : row.connected
            ? t("model list never checked")
            : t("connect a key to check")}
      </div>

      {/*
       * The whole card opens the dossier now, so this row's own clicks must
       * never bubble up to it - Connect and re-check are different actions
       * entirely, and even the Models button, which happens to do the same
       * thing as the card, should not fire it twice.
       */}
      <div
        className="row"
        style={{ marginTop: 12, flexWrap: "wrap" }}
        onClick={(event) => event.stopPropagation()}
      >
        <button onClick={() => onConnect(row)}>{t("Connect")}</button>
        <button className="secondary" type="button" onClick={() => setOpen(true)}>
          {t("Models")} ({row.knownModels.length})
        </button>
        <button
          className="secondary"
          type="button"
          disabled={!row.connected || refreshing}
          title={
            row.connected
              ? `${t("Ask")} ${row.displayName} ${t("what it serves right now")}`
              : t("Connect a key first")
          }
          onClick={() => onRefreshModels(row.id, row.displayName)}
        >
          {refreshing ? t("checking…") : t("re-check")}
        </button>
        <span className="spacer" />
        <span className="small faint">
          {row.connected
            ? `${row.credentialCount} ${row.credentialCount === 1 ? t("key") : t("keys")}`
            : t("none")}
        </span>
      </div>

      {open ? (
        <Modal
          title={row.displayName}
          subtitle={`${dossier.operator} · ${t(dossier.origin)}`}
          onClose={() => setOpen(false)}
          wide
        >
          <dl className="dossier">
            <div>
              <dt>{t("Type")}</dt>
              <dd>{t(KIND_LABEL[dossier.kind])}</dd>
            </div>
            <div className="dossier-freetier">
              <dt>{t("Free tier")}</dt>
              {/* The dossier's own one-liner wins when it has one. */}
              <dd>{t(dossier.freeTierSummary ?? row.freeTier.summary)}</dd>
            </div>
            <div>
              <dt>{t("Credential")}</dt>
              <dd>
                {credentialLabel} · {row.knownModels.length} {t("curated model(s)")}
              </dd>
            </div>
            {dossier.reviewedAt ? (
              <div>
                <dt>{t("Reviewed")}</dt>
                <dd>{dossier.reviewedAt}</dd>
              </div>
            ) : null}
          </dl>

          <p className="small faint" style={{ marginTop: 0 }}>
            {t(dossier.verdictReason)}
          </p>
          {dossier.notes ? <p className="small faint">{t(dossier.notes)}</p> : null}
          {row.notes ? <p className="small faint">{t(row.notes)}</p> : null}

          {/*
           * The dossier's model list carries what a name alone cannot: context
           * window, what the model is good at, and measured latency. When it
           * exists it is the better list, and the plain id list is the fallback.
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
                      <span className="badge bad">{t("retired")}</span>
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
                          {t("add to chain")}
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
                <div className="sub faint">{t("No curated models.")}</div>
              ) : (
                row.knownModels.map((model) => {
                  const retired = staleSet.has(model);
                  return (
                    <div className={`model-list-item${retired ? " retired" : ""}`} key={model}>
                      <span className="model-list-id">{model}</span>
                      <span className="spacer" />
                      {retired ? (
                        <span className="badge bad">{t("retired")}</span>
                      ) : (
                        <a
                          className="small"
                          href={`#/chains?model=${encodeURIComponent(
                            model,
                          )}&provider=${encodeURIComponent(row.id)}`}
                        >
                          {t("add to chain")}
                        </a>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/*
           * Retired models the dossier never described in the first place —
           * the ones above already carry their own "retired" badge inline,
           * so this only needs to cover the gap.
           */}
          {unlistedStale.length > 0 ? (
            <div className="model-list">
              <div className="small faint">
                {t("Retired · gone since")} {timeAgo(checkedAt ?? Date.now())}
              </div>
              {unlistedStale.map((model) => (
                <div className="model-list-item retired" key={model}>
                  <span className="model-list-id">{model}</span>
                  <span className="spacer" />
                  <span className="badge bad">{t("retired")}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="modal-actions">
            {dossier.sourceUrl ? (
              <a className="small" href={dossier.sourceUrl} target="_blank" rel="noreferrer">
                {t("source")}
              </a>
            ) : null}
            {row.signupUrl ? (
              <a className="small" href={row.signupUrl} target="_blank" rel="noreferrer">
                {t("get a free key")}
              </a>
            ) : null}
            <button onClick={() => setOpen(false)}>{t("Close")}</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
