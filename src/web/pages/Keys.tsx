import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, timeAgo } from "../api.js";
import type { ProviderStatus, ProxyPoolEntryView, PublicCredential } from "../types.js";
import { ConnectProviderModal } from "../components/ConnectProviderModal.js";
import { Pagination } from "../components/Pagination.js";
import {
  Empty,
  Modal,
  Panel,
  QuotaLabel,
  RateLabel,
  StatusBadge,
  formatDuration,
  formatNumber,
} from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";

const KEYS_PER_PAGE = 25;

interface ProviderGroup {
  providerId: string;
  displayName: string;
  credentials: PublicCredential[];
}

/**
 * The credential inventory.
 *
 * Secrets are shown masked and only masked. A proxy set by the automatic pool is
 * labelled as such, so it is always obvious which keys will move when the pool
 * changes and which ones are pinned by hand.
 */
export function Keys({
  refreshKey,
  onChanged,
  providers,
}: {
  refreshKey: number;
  onChanged: () => void;
  providers: ProviderStatus[];
}) {
  const toast = useToast();
  const [credentials, setCredentials] = useState<PublicCredential[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<ProviderStatus | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(KEYS_PER_PAGE);

  const load = useCallback(async () => {
    try {
      setCredentials(await api.allCredentials());
    } catch (error) {
      toast.err(error instanceof Error ? error.message : String(error));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const groups = useMemo<ProviderGroup[]>(() => {
    const needle = query.trim().toLowerCase();
    const byProvider = new Map<string, PublicCredential[]>();
    for (const credential of credentials) {
      if (
        needle &&
        ![credential.description, credential.providerId, credential.maskedSecret, credential.status].some(
          (field) => field.toLowerCase().includes(needle),
        )
      ) {
        continue;
      }
      const list = byProvider.get(credential.providerId) ?? [];
      list.push(credential);
      byProvider.set(credential.providerId, list);
    }

    const known = new Map(providers.map((provider) => [provider.id, provider]));
    return [...byProvider.entries()]
      .map(([providerId, list]) => ({
        providerId,
        displayName: known.get(providerId)?.displayName ?? providerId,
        credentials: list,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [credentials, providers, query]);

  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
  const current = Math.min(page, totalPages);
  const visible = groups.slice((current - 1) * pageSize, current * pageSize);

  async function test(credential: PublicCredential) {
    setBusyId(credential.id);
    try {
      const result = await api.testCredential(credential.id);
      if (result.ok) toast.ok(`${credential.description}: verified in ${result.latencyMs ?? 0}ms`);
      else toast.err(`${credential.description}: ${result.classification} ${result.message ?? ""}`);
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
      `Replace the API key for "${credential.description}"?\n\nThe new secret is verified before it is stored.`,
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

  const [assignFor, setAssignFor] = useState<PublicCredential | null>(null);
  const [pool, setPool] = useState<ProxyPoolEntryView[]>([]);
  const [poolBusy, setPoolBusy] = useState(false);

  async function openAssign(credential: PublicCredential) {
    setAssignFor(credential);
    setPoolBusy(true);
    try {
      const result = await api.proxyPool();
      setPool(result.entries);
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setPoolBusy(false);
    }
  }

  async function assignProxy(credential: PublicCredential, poolId: string | null) {
    setPoolBusy(true);
    try {
      await api.updateCredential(credential.id, { proxyPoolId: poolId });
      toast.ok(
        poolId
          ? `${credential.description} pinned to a pool exit`
          : `${credential.description} returned to the automatic pool`,
      );
      setAssignFor(null);
      await load();
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setPoolBusy(false);
    }
  }

  async function remove(credential: PublicCredential) {
    if (!confirm(`Delete credential "${credential.description}"? It is detached from every chain.`))
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
      <Panel
        title={`Credentials (${credentials.length})`}
        actions={
          <input
            className="search"
            placeholder="Search description, provider or state"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        }
      >
        {groups.length === 0 ? (
          <Empty>
            No credentials yet. Connect a provider from the Providers tab. COKEY verifies every key
            before storing it.
          </Empty>
        ) : (
          visible.map((group) => (
            <div key={group.providerId} className="provider-group">
              <div className="provider-group-head">
                <strong>{group.displayName}</strong>
                <span className="mono small faint">{group.providerId}</span>
                <span className="badge">
                  {group.credentials.length} key{group.credentials.length === 1 ? "" : "s"}
                </span>
                <span className="spacer" />
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

              <div className="table-scroll">
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
                          <button
                            className="ghost mono small"
                            style={{ padding: "2px 4px" }}
                            title="Choose this key's exit IP: automatic pool, a specific pool exit, or direct"
                            onClick={() => void openAssign(credential)}
                          >
                            {credential.proxy.configured
                              ? `${credential.proxy.label ?? "proxy"}${credential.proxy.auto ? " (auto)" : " (pinned)"}`
                              : "direct"}
                          </button>
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
            </div>
          ))
        )}

        <Pagination
          page={current}
          totalPages={totalPages}
          total={groups.length}
          pageSize={pageSize}
          noun="provider groups"
          onChange={(params) => {
            if (params.page) setPage(params.page);
            if (params.pageSize) {
              setPageSize(params.pageSize);
              setPage(1);
            }
          }}
        />
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

      {assignFor ? (
        <Modal
          title="Egress for this key"
          subtitle={assignFor.description}
          onClose={() => setAssignFor(null)}
        >
          <p className="small muted" style={{ marginTop: 0 }}>
            COKEY already spreads exits automatically: add proxies to the pool once and every key
            of a provider gets a different one. Leave this on the automatic pool, or pin this key to
            one specific exit.
          </p>

          <div className="selected-list">
            <button
              type="button"
              className={assignFor.proxy.auto ? "secondary" : "ghost"}
              disabled={poolBusy}
              onClick={() => void assignProxy(assignFor, null)}
            >
              Automatic pool
              {assignFor.proxy.auto ? " (current)" : ""}
            </button>

            {poolBusy ? (
              <div className="small faint">Loading the pool…</div>
            ) : pool.length === 0 ? (
              <Empty>
                The pool is empty. Add proxies under Settings, Egress pool, or set{" "}
                <code>COKEY_PROXY_POOL</code> before first start.
              </Empty>
            ) : (
              pool.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="secondary"
                  disabled={poolBusy || !entry.enabled}
                  onClick={() => void assignProxy(assignFor, entry.id)}
                >
                  <span className="mono">{entry.label}</span>
                  <span className="spacer" />
                  <span className="small faint">
                    {entry.enabled ? `${entry.assignedTo} key(s)` : "disabled"}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="modal-actions">
            <button className="ghost" onClick={() => setAssignFor(null)}>
              Close
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
