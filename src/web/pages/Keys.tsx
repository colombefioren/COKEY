import { useCallback, useEffect, useState } from "react";
import { api, ApiError, timeAgo } from "../api.js";
import type { PublicCredential } from "../types.js";
import { Empty, Panel, QuotaLabel, StatusBadge, formatDuration, formatNumber } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";

/** Credential inventory: masked secrets only, never the raw value. */
export function Keys({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const toast = useToast();
  const [credentials, setCredentials] = useState<PublicCredential[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCredentials(await api.credentials());
    } catch (error) {
      toast.err(error instanceof Error ? error.message : String(error));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function test(credential: PublicCredential) {
    setBusyId(credential.id);
    try {
      const result = await api.testCredential(credential.id);
      if (result.ok) toast.ok(`${credential.description}: verified in ${result.latencyMs ?? 0}ms`);
      else toast.err(`${credential.description}: ${result.classification} — ${result.message ?? ""}`);
      await load();
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(credential: PublicCredential) {
    try {
      await api.updateCredential(credential.id, {
        status: credential.status === "disabled" ? "healthy" : "disabled",
      });
      await load();
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  async function remove(credential: PublicCredential) {
    if (!confirm(`Delete credential “${credential.description}”? It is detached from every chain.`))
      return;
    try {
      await api.deleteCredential(credential.id);
      toast.ok("Credential deleted");
      await load();
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  return (
    <Panel title={`Credentials (${credentials.length})`}>
      {credentials.length === 0 ? (
        <Empty>
          No credentials yet. Connect a provider from the Providers tab — COKEY verifies each key before
          storing it.
        </Empty>
      ) : (
        <table>
          <thead>
            <tr>
              <th>State</th>
              <th>Provider</th>
              <th>Description</th>
              <th>Key</th>
              <th>Usage</th>
              <th>Quota</th>
              <th>Last used</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {credentials.map((credential) => (
              <tr key={credential.id}>
                <td>
                  <StatusBadge status={credential.status} />
                  {credential.cooldownUntil && credential.cooldownUntil > Date.now() ? (
                    <div className="small faint">
                      {formatDuration(credential.cooldownUntil - Date.now())} left
                    </div>
                  ) : null}
                </td>
                <td className="mono small">{credential.providerId}</td>
                <td>{credential.description}</td>
                <td className="mono small">{credential.maskedSecret}</td>
                <td className="small muted">
                  {formatNumber(credential.usage.requests)} req ·{" "}
                  {formatNumber(credential.usage.successfulRequests)} ok
                  {credential.usage.totalTokens > 0
                    ? ` · ${formatNumber(credential.usage.totalTokens)} tok`
                    : ""}
                </td>
                <td className="small">
                  <QuotaLabel quota={credential.quota} />
                </td>
                <td className="small muted">
                  {credential.usage.lastUsedAt ? timeAgo(credential.usage.lastUsedAt) : "never"}
                </td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    <button
                      className="secondary"
                      style={{ padding: "4px 9px" }}
                      onClick={() => void test(credential)}
                      disabled={busyId === credential.id}
                    >
                      {busyId === credential.id ? "…" : "Test"}
                    </button>
                    <button className="ghost" onClick={() => void toggle(credential)}>
                      {credential.status === "disabled" ? "enable" : "disable"}
                    </button>
                    <button className="danger" style={{ padding: "4px 9px" }} onClick={() => void remove(credential)}>
                      delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
