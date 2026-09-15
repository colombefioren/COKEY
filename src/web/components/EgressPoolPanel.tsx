import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ProxyPoolResponse, Settings as SettingsModel } from "../types.js";
import { Empty, Panel, Select } from "./Primitives.js";
import { Pagination } from "./Pagination.js";
import { BulkProxyModal } from "./BulkProxyModal.js";
import { useToast } from "./Toast.js";
import { useLang } from "../lang.js";

const POOL_PAGE_SIZE = 10;

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
  const { t } = useLang();
  const [data, setData] = useState<ProxyPoolResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [verifyFirst, setVerifyFirst] = useState(true);

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
      toast.ok(t("Proxy added to the pool"));
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
      toast.ok(t("Proxy removed; affected keys were reassigned"));
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
          ? t("Assignments already up to date")
          : `${result.changed} ${t("credential(s) moved to a new exit IP")}`,
      );
      onSettingsChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function fetchProxifly() {
    setBusy(true);
    try {
      const result = await api.fetchProxifly(undefined, verifyFirst);
      setData(result);
      toast.ok(
        verifyFirst
          ? `${result.added} ${t("working free exit(s) added")} (${result.checked ?? 0} ${t("probed")}, ${result.dead ?? 0} ${t("dead skipped")})`
          : `${result.added} ${t("free exit(s) added from Proxifly")}`,
      );
      onSettingsChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function checkExits() {
    setBusy(true);
    try {
      const result = await api.checkProxyPool();
      setData(result);
      if (result.checked === 0) {
        toast.ok(t("Pool is empty - nothing to check"));
      } else if (result.healthy === result.checked) {
        toast.ok(`${t("All")} ${result.healthy} ${t("exit(s) alive")}`);
      } else {
        toast.ok(
          `${result.healthy}/${result.checked} ${t("alive")} - ${result.removed} ${t("dead exit(s) removed")}`,
        );
      }
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
      toast.ok(enabled ? t("Automatic egress on") : t("Automatic egress off"));
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
      title={
        <span data-tour="proxies-panel">
          {t("Egress pool")} ({entries.length})
        </span>
      }
      actions={
        <div className="row" style={{ gap: 8 }}>
          <label
            className="selected-item"
            style={{ marginBottom: 0, gap: 6, whiteSpace: "nowrap" }}
            title={t("Probe candidates and only import exits that answer")}
          >
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={verifyFirst}
              onChange={(event) => setVerifyFirst(event.target.checked)}
            />
            {t("verify")}
          </label>
          <button className="secondary" onClick={() => void fetchProxifly()} disabled={busy}>
            {t("fetch free proxies (Proxifly)")}
          </button>
          <button className="secondary" onClick={() => void checkExits()} disabled={busy}>
            {t("check exits")}
          </button>
          <button className="secondary" onClick={() => setBulkOpen(true)} disabled={busy}>
            {t("bulk paste")}
          </button>
          <button className="secondary" onClick={() => void sync()} disabled={busy}>
            {t("re-run assignment")}
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
          {t("Assign exits automatically")}
        </label>

        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="auto-proxy-strategy">{t("Assignment strategy")}</label>
          <Select
            id="auto-proxy-strategy"
            value={settings.autoProxyStrategy}
            onChange={(value) => void setStrategy(value as SettingsModel["autoProxyStrategy"])}
          >
            <option value="per-provider">
              {t("Stable per provider (keys stay on the same exit)")}
            </option>
            <option value="round-robin">{t("Rotate by provider order")}</option>
          </Select>
        </div>
      </div>

      <div className="hint-box" style={{ marginBottom: 14 }}>
        <strong>{t("Fetch free proxies (Proxifly):")}</strong>{" "}
        {t(
          "pulls Proxifly's public free list into the pool. It's free because it's public — open exit IPs shared by strangers, so expect them to be slower, flaky, sometimes already dead, and some providers block them on sight. With",
        )}
        <em> {t("verify")}</em>{" "}
        {t(
          "on (default) every candidate is probed first and only exits that answer are imported. The",
        )}{" "}
        <strong>{t("check exits")}</strong>{" "}
        {t(
          "button sweeps the pool and drops the ones that died since. Paste your own paid or residential proxies above for exits you can trust. (We're all poor here — but careful does it.)",
        )}
      </div>

      {status ? (
        <div className="grid cards" style={{ marginBottom: 14 }}>
          <div className="stat">
            <div className="label">{t("Pool size")}</div>
            <div className="value">{status.size}</div>
            <div className="hint">
              {status.enabledCount} {t("enabled")}
            </div>
          </div>
          <div className="stat">
            <div className="label">{t("Providers covered")}</div>
            <div className="value">{status.providerCount}</div>
            <div className="hint">
              {status.assignments} {t("key assignments")}
            </div>
          </div>
          <div className="stat">
            <div className="label">{t("Saturated")}</div>
            <div className="value">{status.saturatedProviders.length}</div>
            <div className="hint">
              {status.saturatedProviders.length === 0
                ? t("Every provider has enough distinct exits")
                : `${status.saturatedProviders.join(", ")} ${t("have more keys than the pool")}`}
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
          {t("Add proxy")}
        </button>
      </div>

      {entries.length === 0 ? (
        <Empty>
          {t(
            "The pool is empty, so every key currently leaves through this machine's own address. Add proxies above, or set",
          )}{" "}
          <code>COKEY_PROXY_POOL</code>{" "}
          {t(
            "to a comma-separated list before first start. COKEY cannot invent an exit IP, so an empty pool means direct egress.",
          )}
        </Empty>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Exit")}</th>
                <th>{t("Keys using it")}</th>
                <th>{t("Added")}</th>
                <th>{t("Enabled")}</th>
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
                      {t("remove")}
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

      {bulkOpen ? (
        <BulkProxyModal
          onClose={() => setBulkOpen(false)}
          onChanged={(next) => {
            setData(next);
            onSettingsChanged();
          }}
        />
      ) : null}
    </Panel>
  );
}
