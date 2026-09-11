import { useState } from "react";
import { api, ApiError } from "../api.js";
import type { ProviderStatus, ValidationResult } from "../types.js";
import { Modal } from "./Primitives.js";
import { useToast } from "./Toast.js";

/**
 * Two-field connect dialog (plus account id for Cloudflare).
 *
 * The credential is verified server-side before it is persisted as healthy, and
 * the verdict is shown inline — never a silent failure.
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
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ValidationResult | undefined>();
  const [error, setError] = useState<string | undefined>();

  const needsAccountId = provider.credentialFields.includes("accountId");

  async function submit(addAnyway = false) {
    if (!description.trim() || !secret.trim()) {
      setError("Description and key are both required");
      return;
    }

    setBusy(true);
    setError(undefined);
    setResult(undefined);

    try {
      const response = await api.connectProvider(provider.id, {
        description: description.trim(),
        secret: secret.trim(),
        ...(needsAccountId && accountId.trim() ? { accountId: accountId.trim() } : {}),
      });
      setResult(response.validation);
      toast.ok(`${provider.displayName} key verified in ${response.validation.latencyMs ?? 0}ms`);
      onConnected();
      onClose();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      setError(message);
      const classification = err instanceof ApiError ? err.classification : undefined;

      if (classification === "network_error") {
        // A transient failure is the one case where keeping the key unverified
        // is the user's call.
        setResult({ ok: false, classification: classification, message });
        if (addAnyway) {
          setError("Network error — retry, or paste the key again once the provider is reachable.");
        }
      } else {
        setResult(classification ? { ok: false, classification, message } : undefined);
      }
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
        <button onClick={() => void submit()} disabled={busy}>
          {busy ? "Verifying…" : "Save & test"}
        </button>
      </div>
    </Modal>
  );
}
