import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, pageQuery, timeAgo } from "../api.js";
import type {
  ModelCatalogView,
  ModelsResponse,
  MyModelRanking,
  SelectableModel,
} from "../types.js";
import { Empty, Panel } from "../components/Primitives.js";
import { Pagination } from "../components/Pagination.js";
import { IconSparkle } from "../components/Icons.js";
import { useToast } from "../components/Toast.js";
import { queryParam, useRoute } from "../router.js";
import { Rankings } from "./Rankings.js";

type ProbeState = { status: "running" | "ok" | "fail"; message: string; latencyMs?: number };

const PROVIDERS_PER_PAGE = 6;
/**
 * Models shown per provider before the grid pages.
 *
 * Some providers return hundreds of models. Rendering all of them made the
 * page into a wall and pushed every other provider off the screen, so each
 * provider's grid pages on its own - the provider is the unit you are browsing,
 * not the model.
 */
const MODELS_PER_PROVIDER = 12;

/**
 * The model catalog, with a live test and the ranking boards alongside it.
 *
 * Two rules shaped this screen:
 *
 *   1. A model is only selectable when its provider has a key COKEY verified.
 *      The rest are visible but greyed, with a signup link, so the gap between
 *      "exists" and "usable" is always visible.
 *   2. The green check is earned, not stored. The play button sends a real
 *      hello through a working key, and only a 200 turns it green.
 */
export function Models({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const { route, navigate } = useRoute();
  const tab =
    route.section === "rankings" ? "rankings" : route.section === "mine" ? "mine" : "catalog";

  return (
    <>
      <div className="tabs tabs-inline">
        <button
          type="button"
          className="tab"
          aria-selected={tab === "catalog"}
          onClick={() => navigate("/models")}
        >
          Catalog
        </button>
        <button
          type="button"
          className="tab"
          aria-selected={tab === "mine"}
          onClick={() => navigate("/models/mine")}
        >
          My models
        </button>
        <button
          type="button"
          className="tab"
          aria-selected={tab === "rankings"}
          onClick={() => navigate("/models/rankings")}
        >
          Rankings
        </button>
      </div>

      {tab === "rankings" ? (
        <Rankings refreshKey={refreshKey} />
      ) : tab === "mine" ? (
        <MyModels refreshKey={refreshKey} onChanged={onChanged} />
      ) : (
        <Catalog
          refreshKey={refreshKey}
          onChanged={onChanged}
          initialQuery={queryParam(route.query, "q") ?? ""}
        />
      )}
    </>
  );
}

/**
 * "My models": only the models this user can actually reach right now,
 * ranked by what happened the times they were asked — not by a curated tier.
 *
 * A model no chain has ever probed still appears (it is usable, after all), just
 * at the bottom and marked as untested rather than ranked zero.
 *
 * The three things anyone wants from this list are here on the row: test it,
 * ask the provider what it serves now, and put it in a chain. A ranking table
 * you cannot act from is a report, and this is meant to be a tool.
 */
const MY_MODELS_PER_PAGE = 25;

function MyModels({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const toast = useToast();
  const [rankings, setRankings] = useState<MyModelRanking[] | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(MY_MODELS_PER_PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  /** Per-model verdict from the last test, keyed by provider/model. */
  const [probes, setProbes] = useState<Record<string, ProbeState>>({});

  const load = useCallback(async () => {
    try {
      const response = await api.myModels();
      setRankings(response.rankings);
    } catch (error) {
      toast.err(error instanceof Error ? error.message : String(error));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = rankings ?? [];
    if (!needle) return all;
    return all.filter((row) =>
      [row.model, row.providerId, row.displayName].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [rankings, query]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, totalPages);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);

  /** One real hello through a working key; the record only moves on a 200. */
  async function test(row: MyModelRanking) {
    const key = `${row.providerId}/${row.model}`;
    setBusy(key);
    setProbes((current) => ({
      ...current,
      [key]: { status: "running", message: "sending hello" },
    }));
    try {
      const result = await api.probeModel({ providerId: row.providerId, model: row.model });
      setProbes((current) => ({
        ...current,
        [key]: result.ok
          ? { status: "ok", message: "working", latencyMs: result.latencyMs }
          : {
              status: "fail",
              message: result.classification ?? "failed",
              latencyMs: result.latencyMs,
            },
      }));
      if (result.ok) toast.ok(`${row.model} · ${result.latencyMs}ms`);
      else toast.err(`${row.model} · ${result.classification ?? "failed"}`);
      await load();
      onChanged();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : String(error);
      setProbes((current) => ({ ...current, [key]: { status: "fail", message } }));
      toast.err(message);
    } finally {
      setBusy(null);
    }
  }

  /** Ask this row's provider what it serves now and report the drift. */
  async function research(row: MyModelRanking) {
    const key = `${row.providerId}/${row.model}`;
    setBusy(key);
    try {
      const report = await api.refreshProviderModels(row.providerId);
      if (!report.ok) {
        toast.err(report.message ?? `${row.displayName} could not be checked`);
      } else {
        const parts = [
          report.added.length ? `${report.added.length} new` : "",
          report.restored.length ? `${report.restored.length} restored` : "",
          report.removed.length ? `${report.removed.length} retired` : "",
        ].filter(Boolean);
        toast.ok(
          parts.length
            ? `${row.displayName}: ${parts.join(", ")}`
            : `${row.displayName} unchanged · ${report.discovered} models · ${report.latencyMs}ms`,
        );
      }
      await load();
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  /** Every connected provider at once — the list-wide version of the row action. */
  async function researchAll() {
    setBusy("all");
    try {
      const result = await api.refreshAllProviderModels();
      toast.ok(
        `checked ${result.refreshed}${result.failed ? ` · ${result.failed} unreachable` : ""}` +
          (result.added ? ` · ${result.added} new` : "") +
          (result.removed ? ` · ${result.removed} retired` : ""),
      );
      await load();
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  const tested = rankings?.filter((row) => row.attempts > 0).length ?? 0;

  return (
    <Panel
      hue="mint"
      icon={<IconSparkle size={14} />}
      title={`My models (${rankings?.length ?? 0})`}
      actions={
        <div className="row" style={{ gap: 8 }}>
          <input
            className="search"
            placeholder="Search model or provider"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
          <button
            type="button"
            className="secondary small"
            disabled={busy !== null}
            title="Ask every connected provider what it serves right now"
            onClick={() => void researchAll()}
          >
            {busy === "all" ? "checking…" : "re-check all"}
          </button>
        </div>
      }
    >
      <p className="small muted" style={{ marginTop: 0 }}>
        {tested} of {rankings?.length ?? 0} tested. Ranked by your own results.
      </p>

      {rankings && rankings.length === 0 ? (
        <Empty>Connect a provider to see your models here.</Empty>
      ) : null}

      {rows.length === 0 && rankings && rankings.length > 0 ? (
        <Empty>No model matches that search.</Empty>
      ) : null}

      {visible.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Model</th>
                <th>Provider</th>
                <th>Success</th>
                <th>Latency</th>
                <th>Checked</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => {
                const key = `${row.providerId}/${row.model}`;
                const probeState = probes[key];
                const rowBusy = busy === key;
                const wasTested = row.attempts > 0;
                return (
                  <tr key={key}>
                    <td className="small faint">{(current - 1) * pageSize + index + 1}</td>
                    <td className="mono small">{row.model}</td>
                    <td className="small">{row.displayName}</td>
                    <td>
                      {wasTested ? (
                        <span className={`badge ${row.lastOk ? "ok" : "bad"}`}>
                          {Math.round((row.successRate ?? 0) * 100)}%
                        </span>
                      ) : (
                        <span className="badge neutral">untested</span>
                      )}
                    </td>
                    <td className="small">
                      {row.avgLatencyMs !== undefined ? `${row.avgLatencyMs}ms` : "—"}
                    </td>
                    <td className="small faint">
                      {row.lastCheckedAt ? timeAgo(row.lastCheckedAt) : "never"}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <button
                          type="button"
                          className={`play${probeState?.status === "ok" ? " ok" : ""}${
                            probeState?.status === "fail" ? " fail" : ""
                          }`}
                          disabled={rowBusy}
                          title={
                            probeState && probeState.status !== "running"
                              ? probeState.message
                              : `Test ${row.model} with a working ${row.displayName} key`
                          }
                          onClick={() => void test(row)}
                        >
                          {probeState?.status === "running" ? "…" : "test"}
                        </button>
                        <button
                          type="button"
                          className="secondary small"
                          disabled={rowBusy}
                          title={`Re-read what ${row.displayName} serves right now`}
                          onClick={() => void research(row)}
                        >
                          re-check
                        </button>
                        <a
                          className="small"
                          href={`#/chains?model=${encodeURIComponent(row.model)}&provider=${encodeURIComponent(
                            row.providerId,
                          )}`}
                          title="Add this model to a chain"
                        >
                          add to chain
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <Pagination
        page={current}
        totalPages={totalPages}
        total={rows.length}
        pageSize={pageSize}
        noun="models"
        onChange={(params) => {
          if (params.page) setPage(params.page);
          if (params.pageSize) {
            setPageSize(params.pageSize);
            setPage(1);
          }
        }}
      />

      <p className="small faint" style={{ marginBottom: 0 }}>
        Ranked by success rate, then speed. A test is one real request through a working key.
      </p>
    </Panel>
  );
}

function Catalog({
  refreshKey,
  onChanged,
  initialQuery,
}: {
  refreshKey: number;
  onChanged: () => void;
  initialQuery: string;
}) {
  const toast = useToast();
  const [data, setData] = useState<ModelsResponse | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PROVIDERS_PER_PAGE);
  const [probes, setProbes] = useState<Record<string, ProbeState>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  /** Per-provider model page, keyed by provider id. Reset by the search box. */
  const [modelPages, setModelPages] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const catalog = await api.models();
        if (!cancelled) setData(catalog);
      } catch (error) {
        if (!cancelled) toast.err(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, toast]);

  const providers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = (data?.providers ?? [])
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
    return all;
  }, [data, query, availableOnly]);

  const totalPages = Math.max(1, Math.ceil(providers.length / pageSize));
  const current = Math.min(page, totalPages);
  const visible = providers.slice((current - 1) * pageSize, current * pageSize);

  const availableProviders = data?.providers.filter((provider) => provider.available).length ?? 0;

  /**
   * Re-ask one provider what it serves and reconcile.
   *
   * The point of this button is that a free tier is not stable. Models appear
   * and disappear without notice, and a catalog that is a week old is a catalog
   * that is offering things the provider retired. Running it tells you exactly
   * what changed instead of silently redrawing.
   */
  async function refreshModels(provider: ModelCatalogView) {
    setRefreshing(provider.providerId);
    try {
      const report = await api.refreshProviderModels(provider.providerId);
      if (!report.ok) {
        toast.err(report.message ?? `${provider.displayName} could not be checked`);
      } else {
        const parts = [
          report.added.length ? `${report.added.length} new` : "",
          report.restored.length ? `${report.restored.length} restored` : "",
          report.removed.length ? `${report.removed.length} retired` : "",
        ].filter(Boolean);
        toast.ok(
          parts.length
            ? `${provider.displayName}: ${parts.join(", ")} model(s)`
            : `${provider.displayName} is unchanged (${report.discovered} models) · ${report.latencyMs}ms`,
        );
      }
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setRefreshing(null);
    }
  }

  /**
   * Run the play button: one real completion through the healthiest key.
   * Green only on a 200, and the reply is kept so the user can see it answered.
   */
  async function probe(provider: ModelCatalogView, model: SelectableModel) {
    const key = `${provider.providerId}/${model.id}`;
    setBusyKey(key);
    setProbes((current) => ({
      ...current,
      [key]: { status: "running", message: "sending hello" },
    }));

    try {
      const result = await api.probeModel({ providerId: provider.providerId, model: model.id });
      if (result.ok) {
        setProbes((current) => ({
          ...current,
          [key]: {
            status: "ok",
            message: result.reply ? `replied: ${result.reply}` : "answered 200",
            latencyMs: result.latencyMs,
          },
        }));
        toast.ok(`${model.id} is working (${result.latencyMs}ms)`);
      } else {
        setProbes((current) => ({
          ...current,
          [key]: {
            status: "fail",
            message: `${result.status ?? "no response"} ${result.classification}${
              result.message ? `: ${result.message}` : ""
            }`,
            latencyMs: result.latencyMs,
          },
        }));
        toast.err(`${model.id} did not answer: ${result.classification}`);
      }
      onChanged();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : String(error);
      setProbes((current) => ({ ...current, [key]: { status: "fail", message } }));
      toast.err(message);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Panel
      hue="pink"
      icon={<IconSparkle size={14} />}
      title={`Catalog (${data?.total ?? 0})`}
      actions={
        <div className="row" style={{ gap: 8 }}>
          <label className="small muted row" style={{ gap: 6 }}>
            <input
              type="checkbox"
              checked={availableOnly}
              style={{ width: "auto" }}
              onChange={(event) => {
                setAvailableOnly(event.target.checked);
                setPage(1);
              }}
            />
            usable only
          </label>
          <input
            className="search"
            placeholder="Search model, use or provider"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
              setModelPages({});
            }}
          />
        </div>
      }
    >
      <p className="small muted" style={{ marginTop: 0 }}>
        {availableProviders}/{data?.providers.length ?? 0} providers usable. <strong>▶</strong>{" "}
        sends one real hello and turns green only on a 200.
      </p>

      {/*
       * A single line naming the catalog drift, rather than making the user
       * notice by subtraction that a model they were using is missing.
       */}
      {data && data.stale > 0 ? (
        <div className="hint-box" style={{ marginBottom: 14 }}>
          {data.stale} model(s) were gone on the last check, so they are hidden. Use{" "}
          <strong>re-check</strong> to look again; the bell lists the chains that depend on one.
        </div>
      ) : null}

      {visible.length === 0 ? <Empty>No models match that search.</Empty> : null}

      <div className="model-providers">
        {visible.map((provider) => {
          const modelPage = modelPages[provider.providerId] ?? 1;
          const modelPagesTotal = Math.max(
            1,
            Math.ceil(provider.models.length / MODELS_PER_PROVIDER),
          );
          const modelPageCurrent = Math.min(modelPage, modelPagesTotal);
          const shownModels = provider.models.slice(
            (modelPageCurrent - 1) * MODELS_PER_PROVIDER,
            modelPageCurrent * MODELS_PER_PROVIDER,
          );
          return (
            <section key={provider.providerId} className="model-provider">
              <header>
                <span className={`dot ${provider.available ? "healthy" : "unverified"}`} />
                <strong>{provider.displayName}</strong>
                <span className="small faint">{provider.freeTier.summary}</span>
                <span className="spacer" />

                {/* What the provider actually returned, versus what the catalog claims. */}
                <span
                  className="badge neutral"
                  title={
                    provider.inventoryCheckedAt
                      ? `Last checked ${timeAgo(provider.inventoryCheckedAt)}`
                      : "Never checked — showing the curated catalog only"
                  }
                >
                  {provider.inventoryCheckedAt
                    ? `${provider.counts.live}/${provider.counts.curated} live`
                    : "not checked"}
                </span>
                {provider.counts.discovered > 0 ? (
                  <span
                    className="badge"
                    title="Models this provider returns that the curated catalog does not list"
                  >
                    +{provider.counts.discovered} new
                  </span>
                ) : null}
                {provider.staleModels.length > 0 ? (
                  <span
                    className="badge bad"
                    title={`No longer returned: ${provider.staleModels.slice(0, 6).join(", ")}`}
                  >
                    {provider.staleModels.length} retired
                  </span>
                ) : null}

                {provider.available ? (
                  <span className="badge">
                    {provider.healthyCount} key{provider.healthyCount === 1 ? "" : "s"}
                  </span>
                ) : provider.credentialCount > 0 ? (
                  <span className="badge warn">keys unhealthy</span>
                ) : (
                  <a className="small" href={provider.signupUrl} target="_blank" rel="noreferrer">
                    get a free key
                  </a>
                )}

                <button
                  type="button"
                  className="secondary small"
                  disabled={provider.credentialCount === 0 || refreshing !== null}
                  title={
                    provider.credentialCount === 0
                      ? `Connect a ${provider.displayName} key to check its model list`
                      : `Ask ${provider.displayName} what it serves right now`
                  }
                  onClick={() => void refreshModels(provider)}
                >
                  {refreshing === provider.providerId ? "checking…" : "re-check"}
                </button>
              </header>

              <div className="model-grid">
                {shownModels.map((model) => {
                  const key = `${provider.providerId}/${model.id}`;
                  const probeState = probes[key];
                  const selectable = provider.available && model.selectable;
                  return (
                    <div key={key} className={`model-chip${selectable ? "" : " locked"}`}>
                      <span className="model-id mono">{model.id}</span>
                      <span className="model-meta small faint">
                        {model.context ? <span>{model.context} ctx</span> : null}
                        {model.bestFor ? <span>{model.bestFor}</span> : null}
                        {model.latencySeconds !== undefined ? (
                          <span>{model.latencySeconds}s</span>
                        ) : null}
                      </span>

                      <span className="model-actions">
                        <button
                          type="button"
                          className={`play${probeState?.status === "ok" ? " ok" : ""}${
                            probeState?.status === "fail" ? " fail" : ""
                          }`}
                          disabled={!selectable || busyKey === key}
                          title={
                            selectable
                              ? `Send a hello to ${model.id} with a working ${provider.displayName} key`
                              : `Connect a working ${provider.displayName} key first`
                          }
                          onClick={() => void probe(provider, model)}
                        >
                          {probeState?.status === "running"
                            ? "…"
                            : probeState?.status === "ok"
                              ? "\u2713"
                              : probeState?.status === "fail"
                                ? "\u2717"
                                : "\u25B6"}
                        </button>
                        <a
                          className="small"
                          href={`#/chains?model=${encodeURIComponent(model.id)}&provider=${encodeURIComponent(
                            provider.providerId,
                          )}`}
                          title="Add this model to a chain"
                        >
                          add to chain
                        </a>
                      </span>

                      {probeState && probeState.status !== "running" ? (
                        <span
                          className={`probe-note small ${probeState.status === "ok" ? "ok" : "err"}`}
                          title={probeState.message}
                        >
                          {probeState.status === "ok" ? "working" : "failed"}
                          {probeState.latencyMs !== undefined
                            ? ` \u00B7 ${probeState.latencyMs}ms`
                            : ""}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {modelPagesTotal > 1 ? (
                <div className="model-pager">
                  <span className="pager-count">
                    {provider.models.length} models · page {modelPageCurrent} of {modelPagesTotal}
                  </span>
                  <span className="spacer" />
                  <div className="pager-nav">
                    <button
                      type="button"
                      className="ghost"
                      disabled={modelPageCurrent <= 1}
                      title="Previous models"
                      onClick={() =>
                        setModelPages((current) => ({
                          ...current,
                          [provider.providerId]: modelPageCurrent - 1,
                        }))
                      }
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={modelPageCurrent >= modelPagesTotal}
                      title="More models"
                      onClick={() =>
                        setModelPages((current) => ({
                          ...current,
                          [provider.providerId]: modelPageCurrent + 1,
                        }))
                      }
                    >
                      ›
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <Pagination
        page={current}
        totalPages={totalPages}
        total={providers.length}
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

      <p className="small faint" style={{ marginBottom: 0 }}>
        API equivalent:{" "}
        <code>
          POST /api/models/probe {pageQuery({}, { providerId: "groq", model: "qwen/qwen3.8-27b" })}
        </code>
      </p>
    </Panel>
  );
}
