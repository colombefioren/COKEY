import { useState } from "react";
import { api } from "../api.js";
import type { ProviderStatus, ValidationResult } from "../types.js";
import { Modal } from "./Primitives.js";
import { useToast } from "./Toast.js";

/**
 * Two-field connect dialog (plus account id for Cloudflare).
 *
 * Two buttons, each an independent contract:
 *  - "Test" probes the raw key without persisting anything — you get a verdict
 *    and can keep editing.
 *  - "Save" persists the key regardless of the verdict. A rejected key is kept
 *    but clearly marked unverified, so nothing silently disappears.
 */
export function ConnectProviderModal({
  provider,
  onClose,
  onConnected,
}: {
  provider: ProviderStatus;
  onClose: () => void;
  onConnected: () => void;
}) {
  const toast = useToast();
  const [description, setDescription] = useState("");
  const [secret, setSecret] = useState("");
  const [accountId, setAccountId] = useState("");
  const [useProxy, setUseProxy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ValidationResult | undefined>();
  const [error, setError] = useState<string | undefined>();

  const needsAccountId = provider.credentialFields.includes("accountId");
  const hasFields = Boolean(description.trim() && secret.trim() && (!needsAccountId || accountId.trim()));

  async function test() {
    if (!hasFields) {
      setError(needsAccountId ? "Description, key and account id are required" : "Description and key are both required");
      return;
    }
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const validation = await api.testProviderSecret(provider.id, {
        secret: secret.trim(),
        ...(needsAccountId ? { accountId: accountId.trim() } : {}),
        useProxy,
      });
      setResult(validation);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!hasFields) {
      setError(needsAccountId ? "Description, key and account id are required" : "Description and key are both required");
      return;
    }
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const response = await api.connectProvider(provider.id, {
        description: description.trim(),
        secret: secret.trim(),
        ...(needsAccountId ? { accountId: accountId.trim() } : {}),
        saveAnyway: true,
        useProxy,
      });
      setResult(response.validation);
      toast.ok(
        response.validation.ok
          ? `${provider.displayName} key verified in ${response.validation.latencyMs ?? 0}ms`
          : `${provider.displayName} key saved (${response.validation.classification})`,
      );
      onConnected();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Connect ${provider.displayName}`}
      subtitle={`${provider.freeTier.summary} · the key never leaves this machine`}
      onClose={onClose}
    >
      <div className="field">
        <label htmlFor="connect-description">Description</label>
        <input
          id="connect-description"
          value={description}
          placeholder="Main account, Personal backup, Second account…"
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="connect-secret">API key</label>
        <input
          id="connect-secret"
          value={secret}
          type="password"
          autoComplete="off"
          placeholder="sk-…"
          onChange={(event) => setSecret(event.target.value)}
        />
      </div>

      {needsAccountId ? (
        <div className="field">
          <label htmlFor="connect-account">Account id</label>
          <input
            id="connect-account"
            value={accountId}
            placeholder="Cloudflare account id"
            onChange={(event) => setAccountId(event.target.value)}
          />
        </div>
      ) : null}

      {result ? (
        <div className={`verify ${result.ok ? "ok" : "err"}`}>
          {result.ok
            ? `✓ Verified · ${provider.displayName} accepted the key · ${result.latencyMs ?? 0}ms`
            : `✗ ${result.classification}${result.message ? ` · ${result.message}` : ""}`}
        </div>
      ) : null}

      {error ? <div className="verify err">{error}</div> : null}

      <label className="selected-item" style={{ marginTop: 14 }}>
        <input
          type="checkbox"
          style={{ width: "auto" }}
          checked={useProxy}
          onChange={(event) => setUseProxy(event.target.checked)}
        />
        Route this test/save through the egress pool
        <span className="small faint" style={{ display: "block", marginLeft: 22 }}>
          Protects your real IP, but free pool exits can hang, error or get blocked — no proxy is
          faster. Off = direct.
        </span>
      </label>

      <div className="hint-box" style={{ marginTop: 14 }}>
        Need a key?{" "}
        <a href={provider.signupUrl} target="_blank" rel="noreferrer">
          Open {provider.displayName} ↗
        </a>
      </div>

      <div className="modal-actions">
        <button className="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button className="secondary" onClick={() => void test()} disabled={busy || !secret.trim()}>
          {busy ? "Testing…" : "Test"}
        </button>
        <button onClick={() => void save()} disabled={busy || !hasFields}>
          {busy ? "Saving…" : "Save key"}
        </button>
      </div>
    </Modal>
  );
}