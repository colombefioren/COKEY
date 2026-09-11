import { useEffect, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ProviderCatalogEntry, Settings as SettingsModel } from "../types.js";
import { Empty, Panel } from "../components/Primitives.js";
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
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [tokenBusy, setTokenBusy] = useState(false);

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

  useEffect(() => {
    void (async () => {
      try {
        const result = await api.authTokenStatus();
        setTokenConfigured(result.authTokenConfigured);
      } catch {
        /* handled by the error boundary */
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

  async function generateToken() {
    setTokenBusy(true);
    try {
      await api.generateAuthToken();
      setTokenConfigured(true);
      // Clear the browser token so the login form reappears with the new token.
      localStorage.removeItem("cokey_auth_token");
      toast.ok("New API token generated. The login form will show the new token.");
      onSaved();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setTokenBusy(false);
    }
  }

  async function revokeToken() {
    if (!confirm("Revoke the management API token? Requests will then be allowed without authentication."))
      return;
    try {
       await api.revokeAuthToken();
      setTokenConfigured(false);
      localStorage.removeItem("cokey_auth_token");
      toast.ok("API token revoked. Requests are now allowed without a bearer token.");
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
                Loopback by default. Binding to 0.0.0.0 exposes the gateway to your network — set an
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
               <label>Auth token</label>
               {tokenConfigured ? (
                 <>
                   <div className="row" style={{ gap: 8, marginTop: 4 }}>
                     <span className="mono small">••••••••••••• (configured)</span>
                     <button
                       className="ghost small"
                       onClick={() => void generateToken()}
                       disabled={tokenBusy}
                       title="Regenerate (invalidates the previous token)"
                     >
                       {tokenBusy ? "…" : "regenerate"}
                     </button>
                     <button className="ghost small danger" onClick={() => void revokeToken()} title="Revoke this token">
                       revoke
                     </button>
                   </div>
                   <div className="small faint" style={{ marginTop: 5 }}>
                     Once configured, auth stays on. Regenerating clears your
                     browser session — you'll log in again with the new token.
                   </div>
                 </>
               ) : (
                 <>
                   <button
                     className="secondary"
                     onClick={() => void generateToken()}
                     disabled={tokenBusy}
                   >
                     {tokenBusy ? "Generating…" : "Generate API token"}
                   </button>
                   <div className="small faint" style={{ marginTop: 5 }}>
                     The gateway is currently open — no bearer token is required.
                     Generate a token to protect it when binding to 0.0.0.0 or a LAN.
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
                setDraft({ ...draft, fallback: { ...draft.fallback, enabled: event.target.checked } })
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
                setDraft({ ...draft, fallback: { ...draft.fallback, entryFallback: event.target.checked } })
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
                fallback: { ...draft.fallback, maxRetriesPerCredential: Number(event.target.value) },
              })
            }
          />
        </div>
      </Panel>

      <Panel title="Free-provider suggestions">
        <label className="selected-item" style={{ marginBottom: 0 }}>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={draft.showFreeProviderNudger}
            onChange={(event) => setDraft({ ...draft, showFreeProviderNudger: event.target.checked })}
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
            onChange={(event) => setDraft({ ...draft, freeProviderTarget: Number(event.target.value) })}
          />
        </div>
        <div className="hint-box">
          The check is entirely local — COKEY never phones home. It only counts providers whose free
          tier they advertise themselves.
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
                onChange={(event) => setDraft({ ...draft, allowPrivateEndpoints: event.target.checked })}
              />
              Allow private, loopback and plain-HTTP endpoints
            </label>
            <div className="hint-box">
              Off by default: custom URLs are checked against the SSRF guard, which blocks loopback,
              private ranges, link-local and cloud metadata addresses. Turn this on only for a service
              you run yourself.
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
                    <button className="danger" style={{ padding: "4px 9px" }} onClick={() => void removeEndpoint(endpoint.id)}>
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
    </>
  );
}
