import { useEffect, useMemo, useState } from "react";
import { api, ApiError, pageQuery } from "../api.js";
import type { ModelCatalogView, ModelsResponse, SelectableModel } from "../types.js";
import { Empty, Panel } from "../components/Primitives.js";
import { Pagination } from "../components/Pagination.js";
import { useToast } from "../components/Toast.js";
import { queryParam, useRoute } from "../router.js";
import { Rankings } from "./Rankings.js";

type ProbeState = { status: "running" | "ok" | "fail"; message: string; latencyMs?: number };

const PROVIDERS_PER_PAGE = 6;

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
  const tab = route.section === "rankings" ? "rankings" : "catalog";

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
          aria-selected={tab === "rankings"}
          onClick={() => navigate("/models/rankings")}
        >
          Rankings
        </button>
      </div>

      {tab === "rankings" ? (
        <Rankings refreshKey={refreshKey} />
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
      title={`Model catalog (${data?.total ?? 0} models)`}
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
            }}
          />
        </div>
      }
    >
      <p className="small muted" style={{ marginTop: 0 }}>
        {availableProviders} of {data?.providers.length ?? 0} providers have a working key. The play
        button sends one real hello through a working key and turns green only when the provider
        answers 200.
      </p>

      {visible.length === 0 ? <Empty>No models match that search.</Empty> : null}

      <div className="model-providers">
        {visible.map((provider) => (
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
                  get a free key
                </a>
              )}
            </header>

            <div className="model-grid">
              {provider.models.map((model) => {
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
          </section>
        ))}
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
