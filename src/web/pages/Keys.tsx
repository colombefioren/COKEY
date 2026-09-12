import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, timeAgo } from "../api.js";
import type { ProviderStatus, PublicCredential } from "../types.js";
import { ConnectProviderModal } from "../components/ConnectProviderModal.js";
import {
  Empty,
  Panel,
  QuotaLabel,
  RateLabel,
  StatusBadge,
  formatDuration,
  formatNumber,
} from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";

interface ProviderGroup {
  providerId: string;
  displayName: string;
  connected: boolean;
  credentials: PublicCredential[];
}

/**
 * Credential inventory, grouped by provider.
 *
 * Secrets are only ever shown masked. Each key can be tested, disabled,
 * replaced (rotated) or revoked; a provider group can gain another key without
 * leaving the page, so a mixed-provider pool is managed in one place.
 */
export function Keys({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const toast = useToast();
  const [credentials, setCredentials] = useState<PublicCredential[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<ProviderStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const [credentialList, providerList] = await Promise.all([
        api.credentials(),
        api.providers(),
      ]);
      setCredentials(credentialList);
      setProviders(providerList);
    } catch (error) {
      toast.err(error instanceof Error ? error.message : String(error));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const groups = useMemo<ProviderGroup[]>(() => {
    const byProvider = new Map<string, PublicCredential[]>();
    for (const credential of credentials) {
      const list = byProvider.get(credential.providerId) ?? [];
      list.push(credential);
      byProvider.set(credential.providerId, list);
    }

    const known = new Map(providers.map((provider) => [provider.id, provider]));
    const result: ProviderGroup[] = [];
    for (const [providerId, list] of byProvider) {
      result.push({
        providerId,
        displayName: known.get(providerId)?.displayName ?? providerId,
        connected: true,
        credentials: list,
      });
    }
    result.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return result;
  }, [credentials, providers]);

  async function test(credential: PublicCredential) {
    setBusyId(credential.id);
    try {
      const result = await api.testCredential(credential.id);
      if (result.ok) toast.ok(`${credential.description}: verified in ${result.latencyMs ?? 0}ms`);
      else
        toast.err(`${credential.description}: ${result.classification} — ${result.message ?? ""}`);
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

  async function replace(credential: PublicCredential) {
    const answer = window.prompt(
      `Replace the API key for “${credential.description}”?\n\nThe new secret is verified before it is stored.`,
      "",
    );
    if (answer === null) return;
    if (!answer.trim()) {
      toast.err("A replacement key cannot be empty");
      return;
    }
    setBusyId(credential.id);
    try {
      await api.updateCredential(credential.id, { secret: answer.trim() });
      await api.testCredential(credential.id);
      toast.ok("Key replaced");
      await load();
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusyId(null);
    }
  }

  async function editProxy(credential: PublicCredential) {
    const current = credential.proxy.label ? `socks5://…@${credential.proxy.label}` : "";
    const answer = window.prompt(
      `Egress proxy for “${credential.description}”\n\n` +
        "Leave empty to restore direct egress.\n" +
        "Examples: socks5://user:pass@host:1080 · http://host:8080",
      current,
    );
    if (answer === null) return;
    if (answer === current && credential.proxy.configured) return;

    try {
      await api.updateCredential(credential.id, { proxyUrl: answer.trim() ? answer.trim() : null });
      toast.ok(answer.trim() ? "Proxy updated" : "Proxy cleared");
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
    <>
      <Panel title={`Credentials by provider (${credentials.length})`}>
        {groups.length === 0 ? (
          <Empty>
            No credentials yet. Connect a provider from the Providers tab — COKEY verifies each key
            before storing it.
          </Empty>
        ) : (
          groups.map((group) => (
            <div key={group.providerId} className="provider-group">
              <div className="provider-group-head">
                <strong>{group.displayName}</strong>
                <span className="mono small faint">{group.providerId}</span>
                <span className="badge">
                  {group.credentials.length} key{group.credentials.length === 1 ? "" : "s"}
                </span>
                <span className="spacer" style={{ flex: 1 }} />
                <button
                  className="secondary"
                  style={{ padding: "4px 9px" }}
                  onClick={() => {
                    const provider = providers.find(
                      (candidate) => candidate.id === group.providerId,
                    );
                    if (provider) setAddingFor(provider);
                  }}
                >
                  + add key
                </button>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>State</th>
                    <th>Description</th>
                    <th>Key</th>
                    <th>Rate / min</th>
                    <th>Egress</th>
                    <th>Usage</th>
                    <th>Quota</th>
                    <th>Last used</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {group.credentials.map((credential) => (
                    <tr key={credential.id}>
                      <td>
                        <StatusBadge status={credential.status} />
                        {credential.cooldownUntil && credential.cooldownUntil > Date.now() ? (
                          <div className="small faint">
                            {formatDuration(credential.cooldownUntil - Date.now())} left
                          </div>
                        ) : null}
                      </td>
                      <td>{credential.description}</td>
                      <td className="mono small">{credential.maskedSecret}</td>
                      <td>
                        <RateLabel rate={credential.rate} />
                      </td>
                      <td className="small">
                        {credential.proxy.configured ? (
                          <button
                            className="ghost mono small"
                            style={{ padding: "2px 4px" }}
                            title="Change or clear this key's egress proxy"
                            onClick={() => void editProxy(credential)}
                          >
                            {credential.proxy.label ?? "proxy"} ↗
                          </button>
                        ) : (
                          <button
                            className="ghost small"
                            style={{ padding: "2px 4px" }}
                            title="Route this key through its own SOCKS5/HTTP proxy"
                            onClick={() => void editProxy(credential)}
                          >
                            direct
                          </button>
                        )}
                      </td>
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
                        {credential.usage.lastUsedAt
                          ? timeAgo(credential.usage.lastUsedAt)
                          : "never"}
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
                          <button className="ghost" onClick={() => void replace(credential)}>
                            replace
                          </button>
                          <button className="ghost" onClick={() => void toggle(credential)}>
                            {credential.status === "disabled" ? "enable" : "disable"}
                          </button>
                          <button
                            className="danger"
                            style={{ padding: "4px 9px" }}
                            onClick={() => void remove(credential)}
                          >
                            revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </Panel>

      {addingFor ? (
        <ConnectProviderModal
          provider={addingFor}
          onClose={() => setAddingFor(null)}
          onConnected={() => {
            void load();
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}
