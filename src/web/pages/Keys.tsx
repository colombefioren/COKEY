import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, timeAgo } from "../api.js";
import type { ProviderStatus, ProxyPoolEntryView, PublicCredential } from "../types.js";
import { ConnectProviderModal } from "../components/ConnectProviderModal.js";
import { Pagination } from "../components/Pagination.js";
import {
  ConfirmModal,
  Empty,
  Modal,
  Panel,
  PromptModal,
  QuotaLabel,
  RateLabel,
  StatusBadge,
  formatDuration,
  formatNumber,
} from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";
import { useLang } from "../lang.js";

const KEYS_PER_PAGE = 25;

interface ProviderGroup {
  providerId: string;
  displayName: string;
  credentials: PublicCredential[];
}

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
  const { t } = useLang();
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
        ![
          credential.description,
          credential.providerId,
          credential.maskedSecret,
          credential.status,
        ].some((field) => field.toLowerCase().includes(needle))
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
      if (result.ok)
        toast.ok(`${credential.description}: ${t("verified in")} ${result.latencyMs ?? 0}ms`);
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

  async function replace(credential: PublicCredential, newSecret: string) {
    if (!newSecret) {
      toast.err(t("A replacement key cannot be empty"));
      return;
    }
    setBusyId(credential.id);
    try {
      await api.updateCredential(credential.id, { secret: newSecret });
      await api.testCredential(credential.id);
      toast.ok(t("Key replaced"));
      setReplacingKey(null);
      await load();
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusyId(null);
    }
  }

  const [removingKey, setRemovingKey] = useState<PublicCredential | null>(null);
  const [replacingKey, setReplacingKey] = useState<PublicCredential | null>(null);
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
          ? `${credential.description} ${t("pinned to a pool exit")}`
          : `${credential.description} ${t("returned to the automatic pool")}`,
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
    try {
      await api.deleteCredential(credential.id);
      toast.ok(t("Credential deleted"));
      setRemovingKey(null);
      await load();
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  return (
    <>
      <Panel
        title={`${t("Keys")} (${credentials.length})`}
        actions={
          <input
            className="search"
            placeholder={t("Search keys")}
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
            {t("No keys yet. Connect a provider and COKEY proves the key before storing it.")}
          </Empty>
        ) : (
          visible.map((group) => (
            <div key={group.providerId} className="provider-group">
              <div className="provider-group-head">
                <strong>{group.displayName}</strong>
                <span className="mono small faint">{group.providerId}</span>
                <span className="badge">
                  {group.credentials.length} {group.credentials.length === 1 ? t("key") : t("keys")}
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
                  + {t("key")}
                </button>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("State")}</th>
                      <th>{t("Name")}</th>
                      <th>{t("Key")}</th>
                      <th>{t("Rate")}</th>
                      <th>{t("Egress")}</th>
                      <th>{t("Usage")}</th>
                      <th>{t("Quota")}</th>
                      <th>{t("Used")}</th>
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
                              {formatDuration(credential.cooldownUntil - Date.now())} {t("left")}
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
                            style={{ padding: "2px 6px" }}
                            title={t(
                              "Exit IP for this key: automatic pool, a pinned exit, or direct",
                            )}
                            onClick={() => void openAssign(credential)}
                          >
                            {credential.proxy.configured
                              ? `${credential.proxy.label ?? t("proxy")}${credential.proxy.auto ? ` (${t("auto")})` : ` (${t("pinned")})`}`
                              : t("direct")}
                          </button>
                        </td>
                        <td className="small muted">
                          {formatNumber(credential.usage.requests)} {t("req")} ·{" "}
                          {formatNumber(credential.usage.successfulRequests)} {t("ok")}
                          {credential.usage.totalTokens > 0
                            ? ` · ${formatNumber(credential.usage.totalTokens)} ${t("tok")}`
                            : ""}
                        </td>
                        <td className="small">
                          <QuotaLabel
                            quota={credential.quota}
                            quotaErrors={credential.usage.quotaErrors}
                            status={credential.status}
                          />
                        </td>
                        <td className="small muted">
                          {credential.usage.lastUsedAt
                            ? timeAgo(credential.usage.lastUsedAt)
                            : t("never")}
                        </td>
                        <td>
                          <div className="row" style={{ gap: 4 }}>
                            <button
                              className="secondary"
                              style={{ padding: "4px 10px" }}
                              onClick={() => void test(credential)}
                              disabled={busyId === credential.id}
                            >
                              {busyId === credential.id ? "…" : t("test")}
                            </button>
                            <button className="ghost" onClick={() => setReplacingKey(credential)}>
                              {t("replace")}
                            </button>
                            <button className="ghost" onClick={() => void toggle(credential)}>
                              {credential.status === "disabled" ? t("enable") : t("disable")}
                            </button>
                            <button
                              className="danger"
                              style={{ padding: "4px 9px" }}
                              onClick={() => setRemovingKey(credential)}
                            >
                              {t("revoke")}
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

      {replacingKey ? (
        <PromptModal
          title={t("Replace API key")}
          message={`${t("Enter a new secret for")} "${replacingKey.description}". ${t("The key is verified before it is stored.")}`}
          defaultValue=""
          placeholder="sk-..."
          onSubmit={(value) => void replace(replacingKey, value)}
          onClose={() => setReplacingKey(null)}
        />
      ) : null}

      {removingKey ? (
        <ConfirmModal
          title={t("Revoke key")}
          message={`${t("Delete credential")} "${removingKey.description}"? ${t("It is detached from every chain.")}`}
          onConfirm={() => void remove(removingKey)}
          onClose={() => setRemovingKey(null)}
          actionLabel={t("Revoke")}
        />
      ) : null}

      {assignFor ? (
        <Modal
          title={t("Egress for this key")}
          subtitle={assignFor.description}
          onClose={() => setAssignFor(null)}
        >
          <p className="small muted" style={{ marginTop: 0 }}>
            {t(
              "Add proxies to the pool once and every key of a provider gets a different exit. Leave this automatic, or pin the key to one exit.",
            )}
          </p>

          <div className="selected-list">
            <button
              type="button"
              className={assignFor.proxy.auto ? "secondary" : "ghost"}
              disabled={poolBusy}
              onClick={() => void assignProxy(assignFor, null)}
            >
              {t("Automatic pool")}
              {assignFor.proxy.auto ? ` (${t("current")})` : ""}
            </button>

            {poolBusy ? (
              <div className="small faint">{t("Loading the pool…")}</div>
            ) : pool.length === 0 ? (
              <Empty>
                {t("The pool is empty. Add proxies under Settings, Egress pool, or set")}{" "}
                <code>COKEY_PROXY_POOL</code> {t("before first start.")}
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
                    {entry.enabled ? `${entry.assignedTo} ${t("key(s)")}` : t("disabled")}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="modal-actions">
            <button className="ghost" onClick={() => setAssignFor(null)}>
              {t("Close")}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
