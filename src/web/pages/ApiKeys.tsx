import { useCallback, useEffect, useState } from "react";
import { api, ApiError, timeAgo } from "../api.js";
import type { ApiKeyView } from "../types.js";
import { ConfirmModal, Empty, Panel } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";
import { useLang } from "../lang.js";

export function ApiKeys({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const toast = useToast();
  const { t } = useLang();
  const [keys, setKeys] = useState<ApiKeyView[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [revokingKey, setRevokingKey] = useState<ApiKeyView | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.apiKeys();
      setKeys(result.data);
    } catch (error) {
      toast.err(error instanceof Error ? error.message : String(error));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.err(t("Give the key a name, e.g. OpenCode"));
      return;
    }
    setBusy(true);
    try {
      const result = await api.createApiKey(trimmed);
      setCreated(result.key);
      setName("");
      await load();
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(key: ApiKeyView) {
    try {
      await api.revokeApiKey(key.id);
      await load();
      onChanged();
      toast.ok(t("API key revoked"));
      setRevokingKey(null);
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  return (
    <>
      <Panel title={t("New API key")}>
        <div className="row wrap">
          <div style={{ flex: "1 1 320px" }}>
            <label htmlFor="api-key-name">{t("Name")}</label>
            <input
              id="api-key-name"
              value={name}
              placeholder="OpenCode, KiloCode, CI…"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void create();
              }}
            />
          </div>
          <button onClick={() => void create()} disabled={busy} style={{ alignSelf: "flex-end" }}>
            {busy ? t("Creating…") : t("Create key")}
          </button>
        </div>
        <div className="small faint" style={{ marginTop: 8 }}>
          {t("Clients send this key as")} <code>Authorization: Bearer …</code> {t("against")}{" "}
          <code>/v1</code>.
        </div>
      </Panel>

      {created ? (
        <Panel title={t("Copy this key now")}>
          <div className="hint-box">
            {t("It is shown once and never stored in plaintext.")}
            <div className="mono" style={{ marginTop: 10, wordBreak: "break-all" }}>
              {created}
            </div>
          </div>
          <div className="row end" style={{ marginTop: 12 }}>
            <button
              className="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(created);
                toast.ok(t("Copied"));
              }}
            >
              {t("Copy")}
            </button>
            <button onClick={() => setCreated(null)}>{t("Done")}</button>
          </div>
        </Panel>
      ) : null}

      <Panel title={`${t("API keys")} (${keys.length})`}>
        {keys.length === 0 ? (
          <Empty>{t("No keys yet — create one above.")}</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("Name")}</th>
                <th>{t("Prefix")}</th>
                <th>{t("Created")}</th>
                <th>{t("Last used")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td className="mono small">{key.prefix}…</td>
                  <td className="small muted">{timeAgo(key.createdAt)}</td>
                  <td className="small muted">
                    {key.lastUsedAt ? timeAgo(key.lastUsedAt) : t("never")}
                  </td>
                  <td>
                    <button
                      className="danger"
                      style={{ padding: "4px 9px" }}
                      onClick={() => setRevokingKey(key)}
                    >
                      {t("revoke")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {revokingKey ? (
        <ConfirmModal
          title={t("Revoke API key")}
          message={`${t("Revoke")} "${revokingKey.name}"? ${t("Clients using it stop working immediately.")}`}
          onConfirm={() => void revoke(revokingKey)}
          onClose={() => setRevokingKey(null)}
          actionLabel={t("Revoke")}
        />
      ) : null}
    </>
  );
}
