import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ProxyPoolResponse, Settings as SettingsModel } from "../types.js";
import { Empty, Panel } from "./Primitives.js";
import { Pagination } from "./Pagination.js";
import { useToast } from "./Toast.js";

const POOL_PAGE_SIZE = 10;

/**
 * The automatic egress pool.
 *
 * Provider limits are tracked per key *and* per IP, so five keys of one provider
 * leaving through one address still trip the same limit. Fill this pool once and
 * COKEY spreads the exits for you:
 *
 *   - every key of a provider gets a different entry;
 *   - keys of different providers may share one, because nothing correlates them;
 *   - the mapping is stable across restarts;
 *   - a proxy pinned by hand is never reassigned.
 *
 * The pool needs real proxies to be useful. COKEY cannot invent an exit IP, so an
 * empty pool means direct egress and the panel says so rather than pretending.
 */
export function EgressPoolPanel({
  settings,
  onSettingsChanged,
  refreshKey,
}: {
  settings: SettingsModel;
  onSettingsChanged: () => void;
  refreshKey: number;
}) {
  const toast = useToast();
  const [data, setData] = useState<ProxyPoolResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      setData(await api.proxyPool());
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function add() {
    const url = draft.trim();
    if (!url) return;
    setBusy(true);
    try {
      setData(await api.addProxy(url));
      setDraft("");
      toast.ok("Proxy added to the pool");
      onSettingsChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, enabled: boolean) {
    try {
      setData(await api.setProxyEnabled(id, enabled));
      onSettingsChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  async function remove(id: string) {
    try {
      setData(await api.removeProxy(id));
      toast.ok("Proxy removed; affected keys were reassigned");
      onSettingsChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  async function sync() {
    setBusy(true);
    try {
      const result = await api.syncProxyPool();
      setData(result);
      toast.ok(
        result.changed === 0
          ? "Assignments already up to date"
          : `${result.changed} credential(s) moved to a new exit IP`,
      );
      onSettingsChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function setAutoProxy(enabled: boolean) {
    try {
      await api.updateSettings({ autoProxy: enabled });
      toast.ok(enabled ? "Automatic egress on" : "Automatic egress off");
      onSettingsChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  async function setStrategy(strategy: SettingsModel["autoProxyStrategy"]) {
    try {
      await api.updateSettings({ autoProxyStrategy: strategy });
      onSettingsChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  const entries = data?.entries ?? [];
  const status = data?.status;
  const totalPages = Math.max(1, Math.ceil(entries.length / POOL_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = entries.slice((current - 1) * POOL_PAGE_SIZE, current * POOL_PAGE_SIZE);

  return (
    <Panel
      title={`Egress pool (${entries.length})`}
      actions={
        <div className="row" style={{ gap: 8 }}>
          <button className="secondary" onClick={() => void sync()} disabled={busy}>
            re-run assignment
          </button>
        </div>
      }
    >
      <div className="grid cols-2">
        <label className="selected-item" style={{ marginBottom: 12 }}>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={settings.autoProxy}
            onChange={(event) => void setAutoProxy(event.target.checked)}
          />
          Assign exits automatically
        </label>

        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="auto-proxy-strategy">Assignment strategy</label>
          <select
            id="auto-proxy-strategy"
            value={settings.autoProxyStrategy}
            onChange={(event) =>
              void setStrategy(event.target.value as SettingsModel["autoProxyStrategy"])
            }
          >
            <option value="per-provider">Stable per provider (keys stay on the same exit)</option>
            <option value="round-robin">Rotate by provider order</option>
          </select>
        </div>
      </div>

      {status ? (
        <div className="grid cards" style={{ marginBottom: 14 }}>
          <div className="stat">
            <div className="label">Pool size</div>
            <div className="value">{status.size}</div>
            <div className="hint">{status.enabledCount} enabled</div>
          </div>
          <div className="stat">
            <div className="label">Providers covered</div>
            <div className="value">{status.providerCount}</div>
            <div className="hint">{status.assignments} key assignments</div>
          </div>
          <div className="stat">
            <div className="label">Saturated</div>
            <div className="value">{status.saturatedProviders.length}</div>
            <div className="hint">
              {status.saturatedProviders.length === 0
                ? "Every provider has enough distinct exits"
                : `${status.saturatedProviders.join(", ")} have more keys than the pool`}
            </div>
          </div>
        </div>
      ) : null}

      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <input
          value={draft}
          placeholder="socks5://user:pass@host:1080 or http://host:8080"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void add();
          }}
        />
        <button onClick={() => void add()} disabled={busy || !draft.trim()}>
          Add proxy
        </button>
      </div>

      {entries.length === 0 ? (
        <Empty>
          The pool is empty, so every key currently leaves through this machine&apos;s own address.
          Add proxies above, or set <code>COKEY_PROXY_POOL</code> to a comma-separated list before
          first start. COKEY cannot invent an exit IP, so an empty pool means direct egress.
        </Empty>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Exit</th>
                <th>Keys using it</th>
                <th>Added</th>
                <th>Enabled</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => (
                <tr key={entry.id}>
                  <td className="mono small">{entry.label}</td>
                  <td className="small">{entry.assignedTo}</td>
                  <td className="small muted">{new Date(entry.createdAt).toLocaleDateString()}</td>
                  <td>
                    <label className="selected-item" style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        style={{ width: "auto" }}
                        checked={entry.enabled}
                        onChange={(event) => void toggle(entry.id, event.target.checked)}
                      />
                    </label>
                  </td>
                  <td>
                    <button
                      className="danger"
                      style={{ padding: "4px 9px" }}
                      onClick={() => void remove(entry.id)}
                    >
                      remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={current}
        totalPages={totalPages}
        total={entries.length}
        pageSize={POOL_PAGE_SIZE}
        noun="exits"
        onChange={(params) => {
          if (params.page) setPage(params.page);
        }}
      />
    </Panel>
  );
}
