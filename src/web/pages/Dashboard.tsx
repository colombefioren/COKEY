import { useCallback, useEffect, useState } from "react";
import { api, timeAgo } from "../api.js";
import type { ChainView, Nudge, RequestLogEntry, Stats } from "../types.js";
import { Nudger } from "../components/Nudger.js";
import { Empty, Panel, Stat, formatDuration, formatNumber } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";

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
  const [stats, setStats] = useState<Stats | null>(null);
  const [chains, setChains] = useState<ChainView[]>([]);
  const [requests, setRequests] = useState<RequestLogEntry[]>([]);

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

      <Panel title="Gateway">
        <div className="grid cards">
          <Stat
            label="Chains"
            value={stats?.chains ?? "-"}
            hint="Each alias is a model id clients can call"
          />
          <Stat
            label="Credentials"
            value={stats?.credentials ?? "-"}
            hint={
              stats
                ? `${stats.healthyCredentials} healthy · ${stats.cooldownCredentials} cooldown · ${stats.invalidCredentials} invalid`
                : undefined
            }
          />
          <Stat
            label="Providers connected"
            value={stats?.providersConnected ?? "-"}
            hint={stats ? `${stats.customEndpoints} custom endpoint(s)` : undefined}
          />
          <Stat
            label="Requests recorded"
            value={stats ? formatNumber(stats.history.total) : "-"}
            hint={
              stats
                ? `${stats.history.fallbackCount} used fallback · avg ${formatDuration(stats.history.averageLatencyMs)}`
                : undefined
            }
          />
        </div>
      </Panel>

      <Panel title="Chain summary">
        {chains.length === 0 ? (
          <Empty>
            No chains yet. Open Chains to create your first one, then add nodes to it.
          </Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Chain</th>
                <th>Nodes</th>
                <th>Key state</th>
                <th>Status</th>
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
                      <span className="badge">{healthy} healthy</span>{" "}
                      {cooldown > 0 ? <span className="badge warn">{cooldown} cooldown</span> : null}{" "}
                      {invalid > 0 ? <span className="badge bad">{invalid} invalid</span> : null}
                    </td>
                    <td className="small muted">{chain.enabled ? "enabled" : "disabled"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Recent requests">
        {requests.length === 0 ? (
          <Empty>Nothing routed yet. Point a client at /v1 and the history shows up here.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Chain</th>
                <th>Model</th>
                <th>Credential</th>
                <th>Result</th>
                <th>Latency</th>
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
                      <span className="badge">ok</span>
                    ) : (
                      <span className="badge bad">{entry.classification}</span>
                    )}
                    {entry.fallback ? (
                      <span className="badge warn" style={{ marginLeft: 4 }}>
                        {entry.fallbackReason ?? "fallback"}
                      </span>
                    ) : null}
                  </td>
                  <td className="small muted">{formatDuration(entry.latencyMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
