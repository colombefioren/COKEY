import { useCallback, useEffect, useState } from "react";
import { api, timeAgo } from "../api.js";
import type { ChainView, Nudge, RequestLogEntry, Stats } from "../types.js";
import { Nudger } from "../components/Nudger.js";
import { ChainFlow } from "../components/ChainFlow.js";
import { Resilience } from "../components/Resilience.js";
import { Empty, Panel, Stat, formatDuration, formatNumber } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";
import { useLang } from "../lang.js";

type DashboardTab = "route" | "resilience" | "activity";

const TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "route", label: "Live route" },
  { id: "resilience", label: "Resilience" },
  { id: "activity", label: "Activity" },
];

export function Dashboard({
  nudge,
  onDismissNudge,
  onGoToProviders,
  refreshKey,
}: {
  nudge: Nudge | null;
  onDismissNudge: () => void;
  onGoToProviders: () => void;
  refreshKey: number;
}) {
  const toast = useToast();
  const { t } = useLang();
  const [tab, setTab] = useState<DashboardTab>("route");
  const [stats, setStats] = useState<Stats | null>(null);
  const [chains, setChains] = useState<ChainView[]>([]);
  const [requests, setRequests] = useState<RequestLogEntry[]>([]);
  const [requestsBusy, setRequestsBusy] = useState(false);

  const refreshRequests = useCallback(async () => {
    setRequestsBusy(true);
    try {
      const requestResult = await api.requests({ pageSize: 6 });
      setRequests(requestResult.data);
    } catch (error) {
      toast.err(error instanceof Error ? error.message : String(error));
    } finally {
      setRequestsBusy(false);
    }
  }, [toast]);

  const load = useCallback(async () => {
    try {
      const [statsResult, chainResult, requestResult] = await Promise.all([
        api.stats(),
        api.chains(),
        api.requests({ pageSize: 6 }),
      ]);
      setStats(statsResult);
      setChains(chainResult);
      setRequests(requestResult.data);
    } catch (error) {
      toast.err(error instanceof Error ? error.message : String(error));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const nudgeBlock =
    nudge && nudge.enabled && nudge.connectedFree < nudge.target ? (
      <Nudger nudge={nudge} onDismiss={onDismissNudge} onGoToProviders={onGoToProviders} />
    ) : null;

  return (
    <>
      {nudgeBlock}

      <div className="tabs tabs-inline" data-tour="dashboard-tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      {tab === "route" ? (
        <Panel title={t("Live route")}>
          <ChainFlow chains={chains} refreshKey={refreshKey} onChanged={() => void load()} />
        </Panel>
      ) : null}

      {tab === "resilience" ? <Resilience /> : null}

      {tab === "activity" ? (
        <>
          <Panel title={t("Gateway")}>
            <div className="grid cards">
              <Stat
                label={t("Chains")}
                value={stats?.chains ?? "-"}
                hint={t("aliases clients call")}
              />
              <Stat
                label={t("Credentials")}
                value={stats?.credentials ?? "-"}
                hint={
                  stats
                    ? `${stats.healthyCredentials} ${t("healthy")} · ${stats.cooldownCredentials} ${t("cooldown")} · ${stats.invalidCredentials} ${t("invalid")}`
                    : undefined
                }
              />
              <Stat
                label={t("Providers connected")}
                value={stats?.providersConnected ?? "-"}
                hint={stats ? `${stats.customEndpoints} ${t("custom endpoint(s)")}` : undefined}
              />
              <Stat
                label={t("Requests")}
                value={stats ? formatNumber(stats.history.total) : "-"}
                hint={
                  stats
                    ? `${stats.history.fallbackCount} ${t("fell back")} · ${t("avg")} ${formatDuration(stats.history.averageLatencyMs)}`
                    : undefined
                }
              />
            </div>
          </Panel>

          <Panel title={t("Chain summary")}>
            {chains.length === 0 ? (
              <Empty>{t("No chains yet — create one in Chains.")}</Empty>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Chain")}</th>
                      <th>{t("Nodes")}</th>
                      <th>{t("Keys")}</th>
                      <th>{t("Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chains.map((chain) => {
                      const credentials = chain.entries.flatMap((entry) => entry.credentials);
                      const healthy = credentials.filter((c) => c.status === "healthy").length;
                      const cooldown = credentials.filter((c) => c.status === "cooldown").length;
                      const invalid = credentials.filter((c) => c.status === "invalid").length;

                      return (
                        <tr key={chain.id}>
                          <td className="mono">{chain.alias}</td>
                          <td>{chain.entries.length}</td>
                          <td className="small">
                            <span className="badge">
                              {healthy} {t("healthy")}
                            </span>{" "}
                            {cooldown > 0 ? (
                              <span className="badge warn">
                                {cooldown} {t("cooldown")}
                              </span>
                            ) : null}{" "}
                            {invalid > 0 ? (
                              <span className="badge bad">
                                {invalid} {t("invalid")}
                              </span>
                            ) : null}
                          </td>
                          <td className="small muted">
                            {chain.enabled ? t("enabled") : t("disabled")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title={t("Recent requests")}
            actions={
              <button
                type="button"
                className="secondary small"
                disabled={requestsBusy}
                onClick={() => void refreshRequests()}
              >
                {requestsBusy ? t("refreshing…") : t("refresh")}
              </button>
            }
          >
            {requests.length === 0 ? (
              <Empty>
                {t("Nothing routed yet. Point a client at")} <code>/v1</code>{" "}
                {t("and it shows up here.")}
              </Empty>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("When")}</th>
                      <th>{t("Chain")}</th>
                      <th>{t("Model")}</th>
                      <th>{t("Credential")}</th>
                      <th>{t("Result")}</th>
                      <th>{t("Latency")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((entry) => (
                      <tr key={entry.id}>
                        <td className="small muted">{timeAgo(entry.at)}</td>
                        <td className="mono small">{entry.chainAlias}</td>
                        <td className="small">{entry.model}</td>
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
                        <td className="small muted">{formatDuration(entry.latencyMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      ) : null}
    </>
  );
}
