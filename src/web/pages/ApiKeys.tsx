import { useCallback, useEffect, useState } from "react";
import { api, ApiError, timeAgo } from "../api.js";
import type { ApiKeyView } from "../types.js";
import { Empty, Panel } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";

export function ApiKeys({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const toast = useToast();
  const [keys, setKeys] = useState<ApiKeyView[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

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
      toast.err("Give the key a name, e.g. OpenCode");
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
    if (!confirm(`Revoke “${key.name}”? Clients using it stop working immediately.`)) return;
    try {
      await api.revokeApiKey(key.id);
      await load();
      onChanged();
      toast.ok("API key revoked");
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  return (
    <>
      <Panel title="New API key">
        <div className="row wrap">
          <div style={{ flex: "1 1 320px" }}>
            <label htmlFor="api-key-name">Name</label>
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
            {busy ? "Creating…" : "Create key"}
          </button>
        </div>
        <div className="small faint" style={{ marginTop: 8 }}>
          Clients send this key as <code>Authorization: Bearer …</code> against <code>/v1</code>.
        </div>
      </Panel>

      {created ? (
        <Panel title="Copy this key now">
          <div className="hint-box">
            It is shown once and never stored in plaintext.
            <div className="mono" style={{ marginTop: 10, wordBreak: "break-all" }}>
              {created}
            </div>
          </div>
          <div className="row end" style={{ marginTop: 12 }}>
            <button
              className="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(created);
                toast.ok("Copied");
              }}
            >
              Copy
            </button>
            <button onClick={() => setCreated(null)}>Done</button>
          </div>
        </Panel>
      ) : null}

      <Panel title={`API keys (${keys.length})`}>
        {keys.length === 0 ? (
          <Empty>No API keys yet. Create one above to connect OpenCode or KiloCode.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Created</th>
                <th>Last used</th>
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
                    {key.lastUsedAt ? timeAgo(key.lastUsedAt) : "never"}
                  </td>
                  <td>
                    <button
                      className="danger"
                      style={{ padding: "4px 9px" }}
                      onClick={() => void revoke(key)}
                    >
                      revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
