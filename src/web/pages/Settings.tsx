import { useEffect, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ProviderCatalogEntry, Settings as SettingsModel } from "../types.js";
import { EgressPoolPanel } from "../components/EgressPoolPanel.js";
import { ConfirmModal, Empty, Panel } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";

/**
 * Gateway settings.
 *
 * Changes apply immediately and persist in SQLite. The fallback policy mirrors
 * spec §36 so the routing knobs are visible rather than implicit.
 */
export function Settings({
  settings,
  onSaved,
  refreshKey,
}: {
  settings: SettingsModel | null;
  onSaved: () => void;
  refreshKey: number;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<SettingsModel | null>(settings);
  const [busy, setBusy] = useState(false);
  const [endpoints, setEndpoints] = useState<ProviderCatalogEntry[]>([]);
  const [endpointName, setEndpointName] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [endpointModels, setEndpointModels] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [confirmingPassword, setConfirmingPassword] = useState(false);

  async function savePassword() {
    if (!newPassword.trim()) return;
    setPasswordBusy(true);
    try {
      await api.setPassword(newPassword.trim());
      setDraft((current) => (current ? { ...current, passwordLocked: true } : current));
      setNewPassword("");
      toast.ok("Password set. It is now permanent.");
      setConfirmingPassword(false);
      onSaved();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setPasswordBusy(false);
    }
  }

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    void (async () => {
      try {
        setEndpoints(await api.customEndpoints());
      } catch {
        /* surfaced elsewhere */
      }
    })();
  }, [refreshKey]);

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      await api.updateSettings({
        port: draft.port,
        host: draft.host,
        logLevel: draft.logLevel,
        showFreeProviderNudger: draft.showFreeProviderNudger,
        freeProviderTarget: draft.freeProviderTarget,
        allowPrivateEndpoints: draft.allowPrivateEndpoints,
        autoProxy: draft.autoProxy,
        autoProxyStrategy: draft.autoProxyStrategy,
        fallback: draft.fallback,
      });
      toast.ok("Settings saved");
      onSaved();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function addEndpoint() {
    if (!endpointName.trim() || !endpointUrl.trim()) {
      toast.err("A display name and base URL are required");
      return;
    }
    try {
      await api.addCustomEndpoint({
        displayName: endpointName.trim(),
        baseUrl: endpointUrl.trim(),
        models: endpointModels
          .split(",")
          .map((model) => model.trim())
          .filter(Boolean),
      });
      setEndpointName("");
      setEndpointUrl("");
      setEndpointModels("");
      setEndpoints(await api.customEndpoints());
      toast.ok("Custom endpoint registered");
      onSaved();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  async function removeEndpoint(providerId: string) {
    try {
      await api.deleteCustomEndpoint(providerId);
      setEndpoints(await api.customEndpoints());
      onSaved();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  if (!draft) return <Empty>Loading settings…</Empty>;

  return (
    <>
      <Panel
        title="Gateway"
        actions={
          <button onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        }
      >
        <div className="grid cols-2">
          <div>
            <div className="field">
              <label htmlFor="setting-port">Port</label>
              <input
                id="setting-port"
                type="number"
                value={draft.port}
                onChange={(event) => setDraft({ ...draft, port: Number(event.target.value) })}
              />
            </div>
            <div className="field">
              <label htmlFor="setting-host">Host</label>
              <input
                id="setting-host"
                value={draft.host}
                onChange={(event) => setDraft({ ...draft, host: event.target.value })}
              />
              <div className="small faint" style={{ marginTop: 5 }}>
                Loopback by default. Binding to 0.0.0.0 exposes the gateway to your network - set an
                auth token first.
              </div>
            </div>
            <div className="field">
              <label htmlFor="setting-log">Log level</label>
              <select
                id="setting-log"
                value={draft.logLevel}
                onChange={(event) =>
                  setDraft({ ...draft, logLevel: event.target.value as SettingsModel["logLevel"] })
                }
              >
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
            </div>
          </div>

          <div>
            <div className="field">
              <label>Data directory</label>
              <input value={draft.dataDir} readOnly />
            </div>
            <div className="field">
              <label>Admin password</label>
              {draft.passwordLocked ? (
                <div className="small faint" style={{ marginTop: 4 }}>
                  Set. The password is permanent and can no longer be changed here.
                </div>
              ) : (
                <>
                  <div className="row" style={{ gap: 8, marginTop: 4 }}>
                    <input
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                    <button
                      className="secondary"
                      onClick={() => setConfirmingPassword(true)}
                      disabled={passwordBusy || !newPassword.trim()}
                    >
                      {passwordBusy ? "Saving…" : "Set password"}
                    </button>
                  </div>
                  <div className="small faint" style={{ marginTop: 5 }}>
                    Currently the default (<code>coco-the-best</code>). Setting a password locks it
                    permanently - there is no way to change it afterwards.
                  </div>
                </>
              )}
            </div>
            <div className="hint-box">
              Config export (no secrets):{" "}
              <a href="/api/config/export" download="cokey-export.json">
                download cokey-export.json
              </a>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Fallback policy">
        <div className="grid cols-2">
          <label className="selected-item" style={{ marginBottom: 0 }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={draft.fallback.enabled}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  fallback: { ...draft.fallback, enabled: event.target.checked },
                })
              }
            />
            Fallback enabled
          </label>
          <label className="selected-item" style={{ marginBottom: 0 }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={draft.fallback.credentialFallback}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  fallback: { ...draft.fallback, credentialFallback: event.target.checked },
                })
              }
            />
            Try the next credential within an entry
          </label>
          <label className="selected-item" style={{ marginBottom: 0 }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={draft.fallback.entryFallback}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  fallback: { ...draft.fallback, entryFallback: event.target.checked },
                })
              }
            />
            Fall through to the next entry
          </label>
          <label className="selected-item" style={{ marginBottom: 0 }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={draft.fallback.cooldownAutomatic}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  fallback: { ...draft.fallback, cooldownAutomatic: event.target.checked },
                })
              }
            />
            Automatic cooldowns
          </label>
        </div>

        <div className="field" style={{ marginTop: 14, maxWidth: 320 }}>
          <label htmlFor="setting-retries">Max retries per credential</label>
          <input
            id="setting-retries"
            type="number"
            min={0}
            max={10}
            value={draft.fallback.maxRetriesPerCredential}
            onChange={(event) =>
              setDraft({
                ...draft,
                fallback: {
                  ...draft.fallback,
                  maxRetriesPerCredential: Number(event.target.value),
                },
              })
            }
          />
        </div>
      </Panel>

      <EgressPoolPanel settings={draft} onSettingsChanged={onSaved} refreshKey={refreshKey} />

      <Panel title="Free-provider suggestions">
        <label className="selected-item" style={{ marginBottom: 0 }}>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={draft.showFreeProviderNudger}
            onChange={(event) =>
              setDraft({ ...draft, showFreeProviderNudger: event.target.checked })
            }
          />
          Show the free-provider nudger
        </label>
        <div className="field" style={{ marginTop: 14, maxWidth: 320 }}>
          <label htmlFor="setting-target">Target number of connected free providers</label>
          <input
            id="setting-target"
            type="number"
            min={0}
            max={50}
            value={draft.freeProviderTarget}
            onChange={(event) =>
              setDraft({ ...draft, freeProviderTarget: Number(event.target.value) })
            }
          />
        </div>
        <div className="hint-box">
          Entirely local — COKEY never phones home, and only providers that advertise a free tier
          are counted.
        </div>
      </Panel>

      <Panel title="Custom OpenAI-compatible endpoints">
        <div className="grid cols-2">
          <div>
            <div className="field">
              <label htmlFor="endpoint-name">Display name</label>
              <input
                id="endpoint-name"
                value={endpointName}
                placeholder="My self-hosted vLLM"
                onChange={(event) => setEndpointName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="endpoint-url">Base URL</label>
              <input
                id="endpoint-url"
                value={endpointUrl}
                placeholder="https://llm.example.com/v1"
                onChange={(event) => setEndpointUrl(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="endpoint-models">Models (comma separated)</label>
              <input
                id="endpoint-models"
                value={endpointModels}
                placeholder="llama-3.3-70b, qwen3-32b"
                onChange={(event) => setEndpointModels(event.target.value)}
              />
            </div>
            <button onClick={() => void addEndpoint()}>Add endpoint</button>
          </div>

          <div>
            <label className="selected-item" style={{ marginBottom: 12 }}>
              <input
                type="checkbox"
                style={{ width: "auto" }}
                checked={draft.allowPrivateEndpoints}
                onChange={(event) =>
                  setDraft({ ...draft, allowPrivateEndpoints: event.target.checked })
                }
              />
              Allow private, loopback and plain-HTTP endpoints
            </label>
            <div className="hint-box">
              Off by default. Custom URLs are SSRF-checked: loopback, private ranges, link-local and
              cloud metadata are all blocked. Enable only for a service you run.
            </div>

            <div className="selected-list" style={{ marginTop: 14 }}>
              {endpoints.length === 0 ? (
                <Empty>No custom endpoints yet.</Empty>
              ) : (
                endpoints.map((endpoint) => (
                  <div key={endpoint.id} className="selected-item">
                    <span>{endpoint.displayName}</span>
                    <span className="mono muted small">{endpoint.baseUrl}</span>
                    <span className="spacer" style={{ flex: 1 }} />
                    <button
                      className="danger"
                      style={{ padding: "4px 9px" }}
                      onClick={() => void removeEndpoint(endpoint.id)}
                    >
                      delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Panel>

      <div className="row end">
        <button className="secondary" onClick={() => setDraft(settings)} disabled={busy}>
          Revert
        </button>
        <button onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>

      {confirmingPassword ? (
        <ConfirmModal
          title="Set password"
          message="Set this password permanently? It cannot be changed again."
          onConfirm={() => void savePassword()}
          onClose={() => setConfirmingPassword(false)}
          actionLabel="Set password"
        />
      ) : null}
    </>
  );
}
