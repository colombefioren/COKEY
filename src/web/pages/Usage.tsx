import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, timeAgo } from "../api.js";
import type { HistoryStats, RequestLogEntry, UsageProviderView, UsageView } from "../types.js";
import { Pagination } from "../components/Pagination.js";
import {
  ConfirmModal,
  Empty,
  Panel,
  Select,
  Stat,
  StatusDot,
  formatDuration,
  formatNumber,
} from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";
import { useLang } from "../lang.js";

const HISTORY_PAGE_SIZE = 25;
const DAILY_PAGE_SIZE = 10;
const MODEL_PAGE_SIZE = 8;

/**
 * Everything the gateway observed, in one place.
 *
 * Usage and requests used to be two screens, which meant the number and the
 * evidence for it lived apart. They are one screen now: the rollup answers "how
 * much", the history answers "and what exactly happened", and the filters apply
 * to both.
 */
type UsageTab = "overview" | "providers" | "requests";

export function Usage({ refreshKey }: { refreshKey: number }) {
  const toast = useToast();
  const { t } = useLang();
  const [tab, setTab] = useState<UsageTab>("overview");

  return (
    <>
      <div className="tabs tabs-inline">
        <button
          type="button"
          className="tab"
          aria-selected={tab === "overview"}
          onClick={() => setTab("overview")}
        >
          {t("Overview")}
        </button>
        <button
          type="button"
          className="tab"
          aria-selected={tab === "providers"}
          onClick={() => setTab("providers")}
        >
          {t("Providers")}
        </button>
        <button
          type="button"
          className="tab"
          aria-selected={tab === "requests"}
          onClick={() => setTab("requests")}
        >
          {t("Requests")}
        </button>
      </div>

      {tab === "overview" ? (
        <ServingNow refreshKey={refreshKey} onError={(message) => toast.err(message)} />
      ) : null}

      {tab === "providers" ? (
        <UsageRollup refreshKey={refreshKey} onError={(message) => toast.err(message)} />
      ) : null}

      {tab === "requests" ? <RequestHistory refreshKey={refreshKey} /> : null}
    </>
  );
}

/** The chain, node and key serving the current request. */
function ServingNow({
  refreshKey,
  onError,
}: {
  refreshKey: number;
  onError: (message: string) => void;
}) {
  const { t } = useLang();
  const [view, setView] = useState<UsageView | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setView(await api.usage());
      } catch (error) {
        onError(error instanceof ApiError ? error.message : String(error));
      }
    })();
  }, [refreshKey, onError]);

  const now = view?.now;

  return (
    <Panel title={<span data-tour="usage-panel">{t("Serving now")}</span>}>
      {!now ? (
        <Empty>{t("Loading…")}</Empty>
      ) : now.active ? (
        <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
          <span className="badge">{now.chainAlias}</span>
          <span className="mono">
            {now.providerId} / {now.model}
          </span>
          <span className="small">
            <StatusDot status="healthy" /> {now.credentialDescription ?? now.credentialId}
            {now.maskedSecret ? (
              <span className="mono small faint"> {now.maskedSecret}</span>
            ) : null}
          </span>
          {now.proxyLabel ? (
            <span className="chip-proxy mono small">
              {t("exit")} {now.proxyLabel}
            </span>
          ) : null}
          {now.fallback ? <span className="badge warn">{t("fallback")}</span> : null}
          <span className="small faint">
            {now.attempts} {t("tries")}
          </span>
          {now.startedAt ? (
            <span className="small faint">
              {t("started")} {timeAgo(now.startedAt)}
            </span>
          ) : null}
        </div>
      ) : (
        <Empty>
          {t("Idle — the next request lands here.")}
          {now.lastOutcome ? ` ${t("Last route:")} ${now.lastOutcome}.` : ""}
        </Empty>
      )}
    </Panel>
  );
}

/** Per-provider, per-key, per-model rollup with the daily table. */
function UsageRollup({
  refreshKey,
  onError,
}: {
  refreshKey: number;
  onError: (message: string) => void;
}) {
  const { t } = useLang();
  const [view, setView] = useState<UsageView | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [dayPage, setDayPage] = useState(1);
  const [daySize, setDaySize] = useState(DAILY_PAGE_SIZE);

  useEffect(() => {
    void (async () => {
      try {
        const result = await api.usage();
        setView(result);
        setProviderId((current) => current ?? result.providers[0]?.providerId ?? null);
      } catch (error) {
        onError(error instanceof ApiError ? error.message : String(error));
      }
    })();
  }, [refreshKey, onError]);

  const provider: UsageProviderView | undefined = useMemo(
    () => view?.providers.find((candidate) => candidate.providerId === providerId),
    [view, providerId],
  );

  useEffect(() => {
    if (!provider) {
      setModel(null);
      return;
    }
    setModel((current) =>
      current && provider.models.some((entry) => entry.model === current)
        ? current
        : (provider.models[0]?.model ?? null),
    );
  }, [provider]);

  const selectedModel = provider?.models.find((entry) => entry.model === model);

  const monthTotals = useMemo(() => {
    const rows = provider?.daily ?? [];
    return {
      requests: rows.reduce((sum, row) => sum + row.requests, 0),
      inputTokens: rows.reduce((sum, row) => sum + row.inputTokens, 0),
      outputTokens: rows.reduce((sum, row) => sum + row.outputTokens, 0),
    };
  }, [provider]);

  const dayTotalPages = Math.max(1, Math.ceil((provider?.daily.length ?? 0) / daySize));
  const dayCurrent = Math.min(dayPage, dayTotalPages);
  const dayRows = (provider?.daily ?? []).slice((dayCurrent - 1) * daySize, dayCurrent * daySize);

  if (!view)
    return (
      <Panel title={t("Usage by provider")}>
        <Empty>{t("Loading usage…")}</Empty>
      </Panel>
    );

  return (
    <>
      <Panel title={t("Chain state")}>
        {view.chains.length === 0 ? (
          <Empty>{t("No chains configured.")}</Empty>
        ) : (
          <div className="stack">
            {view.chains.map((chain) => (
              <div key={chain.id} className="model-provider">
                <header>
                  <strong className="mono">{chain.alias}</strong>
                  {chain.enabled ? null : <span className="badge warn">{t("disabled")}</span>}
                  <span className="spacer" />
                  <span className="small faint">
                    {chain.entries.length} {t("nodes")}
                  </span>
                </header>
                <div className="stack">
                  {chain.entries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="row wrap"
                      style={{ gap: 8, alignItems: "center" }}
                    >
                      <span className="small faint">{index + 1}.</span>
                      <span className="mono">
                        {entry.providerId} / {entry.model}
                      </span>
                      {entry.enabled ? null : <span className="badge warn">{t("off")}</span>}
                      <span className="badge">{entry.routingStrategy}</span>
                      <span className="small faint">{t("keys:")}</span>
                      {entry.credentials.length === 0 ? (
                        <span className="badge bad">{t("none")}</span>
                      ) : (
                        entry.credentials.map((credential) => (
                          <span
                            key={credential.id}
                            className="cred-chip"
                            title={`${credential.status}${credential.active ? ` · ${t("serving now")}` : ""}`}
                            style={credential.active ? { borderColor: "var(--ok)" } : undefined}
                          >
                            <StatusDot status={credential.status as never} />
                            {credential.description}
                            {credential.active ? <span className="badge">{t("now")}</span> : null}
                          </span>
                        ))
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={t("Usage by provider")}>
        {view.providers.length === 0 ? (
          <Empty>
            {t("Nothing recorded yet. Send a request to")} <code>/v1/chat/completions</code>.
          </Empty>
        ) : (
          <>
            <div className="tabs tabs-inline" style={{ marginBottom: 12 }}>
              {view.providers.map((entry) => (
                <button
                  key={entry.providerId}
                  className="tab"
                  aria-selected={entry.providerId === providerId}
                  onClick={() => {
                    setProviderId(entry.providerId);
                    setDayPage(1);
                    setModel(null);
                  }}
                  type="button"
                >
                  {entry.displayName}
                </button>
              ))}
            </div>

            {provider ? (
              <>
                <div className="grid cards">
                  <Stat label={t("Models used")} value={provider.models.length} />
                  <Stat label={t("Keys")} value={provider.credentials.length} />
                  <Stat label={t("30-day requests")} value={formatNumber(monthTotals.requests)} />
                  <Stat
                    label={t("30-day tokens")}
                    value={formatNumber(monthTotals.inputTokens + monthTotals.outputTokens)}
                    hint={`${formatNumber(monthTotals.inputTokens)} ${t("in")} · ${formatNumber(
                      monthTotals.outputTokens,
                    )} ${t("out")}`}
                  />
                </div>

                <div className="row wrap" style={{ gap: 6, margin: "14px 0" }}>
                  {provider.models.length === 0 ? (
                    <span className="small faint">{t("No model usage yet.")}</span>
                  ) : (
                    provider.models.map((entry) => (
                      <button
                        key={entry.model}
                        className={entry.model === model ? "secondary" : "ghost"}
                        onClick={() => setModel(entry.model)}
                        type="button"
                        title={`${entry.requests} ${t("requests")}`}
                      >
                        {entry.model}
                      </button>
                    ))
                  )}
                </div>

                {selectedModel ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("Key")}</th>
                          <th>{t("State")}</th>
                          <th>{t("Requests")}</th>
                          <th>{t("Tokens in / out")}</th>
                          <th>{t("Rate / min")}</th>
                          <th>{t("Quota vs limit")}</th>
                          <th>{t("Reset")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {provider.credentials.slice(0, MODEL_PAGE_SIZE * 4).map((credential) => {
                          const usage = selectedModel.perCredential.find(
                            (entry) => entry.credentialId === credential.id,
                          );
                          return (
                            <tr key={credential.id}>
                              <td>
                                <span className="mono small">{credential.description}</span>
                                <div className="mono small faint">{credential.maskedSecret}</div>
                              </td>
                              <td>
                                <StatusDot status={credential.status} />
                                <span className="small"> {credential.status}</span>
                              </td>
                              <td className="small">{formatNumber(usage?.requests ?? 0)}</td>
                              <td className="small muted">
                                {formatNumber(usage?.inputTokens ?? 0)} /{" "}
                                {formatNumber(usage?.outputTokens ?? 0)}
                              </td>
                              <td className="small">{credential.rate.requestsPerMinute}/min</td>
                              <td className="small">
                                <QuotaVsLimit quota={credential.quota} />
                              </td>
                              <td className="small faint">
                                {credential.quota?.available && credential.quota.resetAt
                                  ? timeAgo(credential.quota.resetAt)
                                  : t("unknown")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>{t("No model usage for this provider yet.")}</Empty>
                )}

                <h4 className="section-title">{t("Daily rollup")}</h4>
                {provider.daily.length === 0 ? (
                  <Empty>{t("No daily totals yet.")}</Empty>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("Day")}</th>
                          <th>{t("Requests")}</th>
                          <th>{t("Tokens in")}</th>
                          <th>{t("Tokens out")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayRows.map((day) => (
                          <tr key={day.day}>
                            <td className="mono small">
                              {day.day}
                              {day.day === view.today ? (
                                <span className="badge"> {t("today")}</span>
                              ) : null}
                            </td>
                            <td className="small">{formatNumber(day.requests)}</td>
                            <td className="small muted">{formatNumber(day.inputTokens)}</td>
                            <td className="small muted">{formatNumber(day.outputTokens)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <Pagination
                  page={dayCurrent}
                  totalPages={dayTotalPages}
                  total={provider.daily.length}
                  pageSize={daySize}
                  noun="days"
                  onChange={(params) => {
                    if (params.page) setDayPage(params.page);
                    if (params.pageSize) {
                      setDaySize(params.pageSize);
                      setDayPage(1);
                    }
                  }}
                />
              </>
            ) : null}
          </>
        )}
      </Panel>
    </>
  );
}

/** Local request history with filters and a real pager. */
function RequestHistory({ refreshKey }: { refreshKey: number }) {
  const toast = useToast();
  const { t } = useLang();
  const [entries, setEntries] = useState<RequestLogEntry[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(HISTORY_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [clearingHistory, setClearingHistory] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.requests({ page, pageSize, q: query }, { outcome });
      setEntries(result.data);
      setStats(result.stats);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }, [page, pageSize, query, outcome, toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function clear() {
    try {
      await api.clearRequests();
      await load();
      toast.ok(t("History cleared"));
      setClearingHistory(false);
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  return (
    <>
      <Panel title={t("Request statistics")}>
        <div className="grid cards">
          <Stat label={t("Recorded")} value={stats ? formatNumber(stats.total) : "0"} />
          <Stat label={t("Succeeded")} value={stats ? formatNumber(stats.success) : "0"} />
          <Stat label={t("Failed")} value={stats ? formatNumber(stats.failure) : "0"} />
          <Stat
            label={t("Used fallback")}
            value={stats ? formatNumber(stats.fallbackCount) : "0"}
            hint={t("Requests that rotated to another key or node")}
          />
          <Stat
            label={t("Average latency")}
            value={stats ? formatDuration(stats.averageLatencyMs) : "0ms"}
          />
        </div>
      </Panel>

      <Panel
        title={`${t("Request history")} (${total})`}
        actions={
          <div className="row" style={{ gap: 8 }}>
            <Select
              value={outcome}
              onChange={(value) => {
                setOutcome(value);
                setPage(1);
              }}
              style={{ width: 130 }}
            >
              <option value="">{t("All outcomes")}</option>
              <option value="success">{t("Succeeded")}</option>
              <option value="error">{t("Failed")}</option>
            </Select>
            <input
              className="search"
              placeholder={t("Search chain, model or key")}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
            <button
              className="secondary"
              onClick={() => setClearingHistory(true)}
              disabled={total === 0}
            >
              {t("Clear")}
            </button>
          </div>
        }
      >
        {entries.length === 0 ? (
          <Empty>
            {t("Nothing recorded yet. Send a request to")} <code>/v1/chat/completions</code>.
          </Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("When")}</th>
                  <th>{t("Chain")}</th>
                  <th>{t("Provider / model")}</th>
                  <th>{t("Key")}</th>
                  <th>{t("Result")}</th>
                  <th>{t("Attempts")}</th>
                  <th>{t("Latency")}</th>
                  <th>{t("Mode")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="small muted">{timeAgo(entry.at)}</td>
                    <td className="mono small">{entry.chainAlias}</td>
                    <td className="small">
                      {entry.providerId} / {entry.model}
                    </td>
                    <td className="small">{entry.credentialDescription}</td>
                    <td className="small">
                      {entry.outcome === "success" ? (
                        <span className="badge">{t("ok")}</span>
                      ) : (
                        <span className="badge bad">{entry.classification}</span>
                      )}
                      {entry.fallback ? (
                        <span className="badge warn" style={{ marginLeft: 4 }}>
                          {entry.fallbackReason ?? t("fallback")}
                        </span>
                      ) : null}
                    </td>
                    <td className="small muted">{entry.attempts}</td>
                    <td className="small muted">{formatDuration(entry.latencyMs)}</td>
                    <td className="small faint">{entry.stream ? t("stream") : t("buffered")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          noun="requests"
          onChange={(params) => {
            if (params.page) setPage(params.page);
            if (params.pageSize) {
              setPageSize(params.pageSize);
              setPage(1);
            }
          }}
        />
      </Panel>

      {clearingHistory ? (
        <ConfirmModal
          title={t("Clear request history")}
          message={t("Clear the local request history? This cannot be undone.")}
          onConfirm={() => void clear()}
          onClose={() => setClearingHistory(false)}
          actionLabel={t("Clear")}
        />
      ) : null}
    </>
  );
}

/**
 * Remaining quota against the declared limit, or an honest "unknown".
 *
 * Providers rarely expose limits, so a missing number is reported as unknown
 * rather than drawn as a fabricated bar.
 */
function QuotaVsLimit({
  quota,
}: {
  quota?: UsageView["providers"][number]["credentials"][number]["quota"];
}) {
  const { t } = useLang();
  if (!quota || !quota.available) return <span className="faint">{t("no declared limit")}</span>;

  const parts: string[] = [];
  if (typeof quota.requestsRemaining === "number")
    parts.push(`${formatNumber(quota.requestsRemaining)} ${t("req left")}`);
  if (typeof quota.tokensRemaining === "number")
    parts.push(`${formatNumber(quota.tokensRemaining)} ${t("tok left")}`);
  if (typeof quota.requestsPerMinute === "number") parts.push(`${quota.requestsPerMinute} RPM`);
  if (typeof quota.tokensPerMinute === "number")
    parts.push(`${formatNumber(quota.tokensPerMinute)} TPM`);
  if (parts.length === 0) return <span className="faint">{t("no declared limit")}</span>;

  return (
    <span className="muted" title={`${t("source:")} ${quota.source}`}>
      {parts.join(" · ")}
      <span className="faint small"> ({quota.source})</span>
    </span>
  );
}
