import { useCallback, useEffect, useState } from "react";
import { api, ApiError, timeAgo } from "../api.js";
import type { HistoryStats, RequestLogEntry } from "../types.js";
import { Empty, Panel, Stat, formatDuration, formatNumber } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";

/** Local observability: what COKEY actually did with each request. */
export function Requests({ refreshKey }: { refreshKey: number }) {
  const toast = useToast();
  const [entries, setEntries] = useState<RequestLogEntry[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.requests(150);
      setEntries(result.data);
      setStats(result.stats);
    } catch (error) {
      toast.err(error instanceof Error ? error.message : String(error));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function clear() {
    if (!confirm("Clear the local request history?")) return;
    try {
      await api.clearRequests();
      await load();
      toast.ok("History cleared");
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  return (
    <>
      <Panel title="Request statistics">
        <div className="grid cards">
          <Stat label="Recorded" value={stats ? formatNumber(stats.total) : "—"} />
          <Stat label="Succeeded" value={stats ? formatNumber(stats.success) : "—"} />
          <Stat label="Failed" value={stats ? formatNumber(stats.failure) : "—"} />
          <Stat
            label="Used fallback"
            value={stats ? formatNumber(stats.fallbackCount) : "—"}
            hint="Requests that rotated to another credential or entry"
          />
          <Stat
            label="Average latency"
            value={stats ? formatDuration(stats.averageLatencyMs) : "—"}
          />
        </div>
      </Panel>

      <Panel
        title="History"
        actions={
          <button className="secondary" onClick={() => void clear()} disabled={entries.length === 0}>
            Clear
          </button>
        }
      >
        {entries.length === 0 ? (
          <Empty>Nothing recorded yet. Send a request to /v1/chat/completions.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Chain</th>
                <th>Provider / model</th>
                <th>Credential</th>
                <th>Result</th>
                <th>Attempts</th>
                <th>Latency</th>
                <th>Mode</th>
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
                  <td className="small muted">{entry.attempts}</td>
                  <td className="small muted">{formatDuration(entry.latencyMs)}</td>
                  <td className="small faint">{entry.stream ? "stream" : "buffered"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
