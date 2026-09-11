import { useEffect, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ChainEntryView, PublicCredential, ValidationResult } from "../types.js";
import { Modal } from "./Primitives.js";
import { useToast } from "./Toast.js";

/**
 * Add a key to a chain entry.
 *
 * The verification gate lives on the server: a new key is only attached if the
 * provider accepts it for this specific model. Failures are reported inline
 * with the classification that caused them.
 */
export function AddCredentialModal({
  entry,
  onClose,
  onChanged,
}: {
  entry: ChainEntryView;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [description, setDescription] = useState("");
  const [secret, setSecret] = useState("");
  const [accountId, setAccountId] = useState("");
  const [candidates, setCandidates] = useState<PublicCredential[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ValidationResult | undefined>();
  const [error, setError] = useState<string | undefined>();

  const needsAccountId = entry.provider?.credentialFields.includes("accountId") ?? false;

  useEffect(() => {
    void (async () => {
      const all = await api.credentials();
      const bindable = all.filter(
        (credential) =>
          credential.providerId === entry.providerId && !entry.credentialIds.includes(credential.id),
      );
      setCandidates(bindable);
      if (bindable.length === 0) setMode("new");
      else setSelectedId(bindable[0]!.id);
    })();
  }, [entry.credentialIds, entry.providerId]);

  async function attachExisting() {
    setBusy(true);
    setError(undefined);
    try {
      await api.addEntryCredential(entry.id, { credentialId: selectedId });
      toast.ok("Credential attached");
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function createAndVerify() {
    if (!description.trim() || !secret.trim()) {
      setError("Description and key are both required");
      return;
    }
    setBusy(true);
    setError(undefined);
    setResult(undefined);

    try {
      const response = await api.addEntryCredential(entry.id, {
        description: description.trim(),
        secret: secret.trim(),
        ...(needsAccountId && accountId.trim() ? { accountId: accountId.trim() } : {}),
      });
      setResult(response.validation);
      toast.ok(`Verified and attached to ${entry.providerId}/${entry.model}`);
      onChanged();
      onClose();
    } catch (err) {
      const classification = err instanceof ApiError ? err.classification : undefined;
      const message = err instanceof ApiError ? err.message : String(err);
      setError(message);
      if (classification) setResult({ ok: false, classification, message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Add key · ${entry.providerId} / ${entry.model}`}
      subtitle={
        entry.provider?.verification.method === "chat"
          ? "A one-token probe verifies the key against this exact model."
          : "The key is verified against the provider's model list."
      }
      onClose={onClose}
    >
      {candidates.length > 0 ? (
        <div className="row" style={{ marginBottom: 14 }}>
          <button
            className={mode === "existing" ? "" : "secondary"}
            onClick={() => setMode("existing")}
          >
            Use existing key
          </button>
          <button className={mode === "new" ? "" : "secondary"} onClick={() => setMode("new")}>
            Add a new key
          </button>
        </div>
      ) : null}

      {mode === "existing" ? (
        <>
          <div className="field">
            <label htmlFor="existing-credential">Credential</label>
            <select
              id="existing-credential"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {candidates.map((credential) => (
                <option key={credential.id} value={credential.id}>
                  {credential.description} · {credential.maskedSecret} · {credential.status}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button className="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button onClick={() => void attachExisting()} disabled={busy || !selectedId}>
              Attach
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="credential-description">Description</label>
            <input
              id="credential-description"
              value={description}
              placeholder="Main account"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="credential-secret">API key</label>
            <input
              id="credential-secret"
              type="password"
              autoComplete="off"
              value={secret}
              placeholder="sk-…"
              onChange={(event) => setSecret(event.target.value)}
            />
          </div>

          {needsAccountId ? (
            <div className="field">
              <label htmlFor="credential-account">Account id</label>
              <input
                id="credential-account"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              />
            </div>
          ) : null}

          {busy ? <div className="verify pending">Verifying with {entry.providerId}…</div> : null}
          {result?.ok ? (
            <div className="verify ok">
              ✓ Verified · {entry.providerId} accepted the key · {result.latencyMs ?? 0}ms
            </div>
          ) : null}
          {error ? <div className="verify err">✗ {error}</div> : null}

          <div className="modal-actions">
            <button className="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button onClick={() => void createAndVerify()} disabled={busy}>
              {busy ? "Verifying…" : "Save & test"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
