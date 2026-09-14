import { useEffect, useState } from "react";
import { api, ApiError } from "../api.js";
import { href } from "../router.js";
import type { ChainEntryView, PublicCredential, ValidationResult } from "../types.js";
import { Modal } from "./Primitives.js";
import { useToast } from "./Toast.js";
import { useLang } from "../lang.js";

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
  const { t } = useLang();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [description, setDescription] = useState("");
  const [secret, setSecret] = useState("");
  const [accountId, setAccountId] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [candidates, setCandidates] = useState<PublicCredential[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ValidationResult | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [useProxy, setUseProxy] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const needsAccountId = entry.provider?.credentialFields.includes("accountId") ?? false;

  useEffect(() => {
    void (async () => {
      const all = await api.allCredentials();
      const bindable = all.filter(
        (credential) =>
          credential.providerId === entry.providerId &&
          !entry.credentialIds.includes(credential.id),
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
      toast.ok(t("Credential attached"));
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function testNew() {
    if (!secret.trim()) {
      setError(t("Key is required"));
      return;
    }
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      // Probes against the exact model of this entry, but stores nothing.
      const validation = await api.testProviderSecret(entry.providerId, {
        secret: secret.trim(),
        ...(needsAccountId && accountId.trim() ? { accountId: accountId.trim() } : {}),
        model: entry.model,
        useProxy,
      });
      setResult(validation);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      const classification = err instanceof ApiError ? err.classification : undefined;
      setError(message);
      if (classification) setResult({ ok: false, classification, message });
    } finally {
      setBusy(false);
    }
  }

  async function createAndVerify() {
    if (!description.trim() || !secret.trim()) {
      setError(t("Name and key are both required"));
      return;
    }
    if (!agreed) {
      setError(t("Agree to the Terms before saving a key"));
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
        // A distinct proxy per key is what makes several keys from one provider
        // fail over independently instead of sharing an IP-level limit.
        ...(proxyUrl.trim() ? { proxyUrl: proxyUrl.trim() } : {}),
        // The user asked for this key explicitly: save it even if the probe
        // rejects it, clearly marked unverified.
        saveAnyway: true,
        useProxy,
      });
      setResult(response.validation);
      toast.ok(
        response.validation.ok
          ? `${t("Verified and attached to")} ${entry.providerId}/${entry.model}`
          : `${t("Saved")} (${response.validation.classification}) ${t("and attached to")} ${entry.providerId}/${entry.model}`,
      );
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
      title={`${t("Add key")} · ${entry.providerId} / ${entry.model}`}
      subtitle={
        entry.provider?.verification.method === "chat"
          ? t("A one-token probe verifies the key against this exact model.")
          : t("The key is verified against the provider's model list.")
      }
      onClose={onClose}
    >
      {candidates.length > 0 ? (
        <div className="row" style={{ marginBottom: 14 }}>
          <button
            className={mode === "existing" ? "" : "secondary"}
            onClick={() => setMode("existing")}
          >
            {t("Use existing key")}
          </button>
          <button className={mode === "new" ? "" : "secondary"} onClick={() => setMode("new")}>
            {t("Add a new key")}
          </button>
        </div>
      ) : null}

      {mode === "existing" ? (
        <>
          <div className="field">
            <label htmlFor="existing-credential">{t("Credential")}</label>
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
              {t("Cancel")}
            </button>
            <button onClick={() => void attachExisting()} disabled={busy || !selectedId}>
              {t("Attach")}
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="selected-item">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            {t("I agree to the")}{" "}
            <a href={href("/terms")} target="_blank" rel="noreferrer">
              {t("Terms")}
            </a>
          </label>

          <div className="field">
            <label htmlFor="credential-description">{t("Name")}</label>
            <input
              id="credential-description"
              value={description}
              maxLength={120}
              placeholder={t("Main account")}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="credential-secret">{t("API key")}</label>
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
              <label htmlFor="credential-account">{t("Account id")}</label>
              <input
                id="credential-account"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="credential-proxy">{t("Egress proxy (optional override)")}</label>
            <input
              id="credential-proxy"
              value={proxyUrl}
              placeholder={t("Leave empty to use the automatic pool")}
              onChange={(event) => setProxyUrl(event.target.value)}
            />
            <span className="small faint">
              {t(
                "COKEY already assigns exit IPs on its own: add proxies to the egress pool once and every key of a provider gets a different one, re-planned as keys appear. Leave this empty to inherit that. Type a URL here only to pin this key to a specific exit, which overrides the pool for it.",
              )}
            </span>
          </div>

          <label className="selected-item" style={{ marginBottom: 12 }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={useProxy}
              onChange={(event) => setUseProxy(event.target.checked)}
            />
            {t("Route this test/save through the egress pool")}
            <span className="small faint" style={{ display: "block", marginLeft: 22 }}>
              {t(
                "Protects your real IP, but free pool exits can hang, error or get blocked — no proxy is faster. Off = direct.",
              )}
            </span>
          </label>

          {entry.provider?.signupUrl ? (
            <div className="hint-box" style={{ marginTop: 14 }}>
              {t("Need a key?")}{" "}
              <a href={entry.provider.signupUrl} target="_blank" rel="noreferrer">
                {t("Open")} {entry.provider.displayName} ↗
              </a>
            </div>
          ) : null}

          {busy ? (
            <div className="verify pending">
              {t("Verifying with")} {entry.providerId}…
            </div>
          ) : null}
          {result?.ok ? (
            <div className="verify ok">
              ✓ {t("Verified")} · {entry.providerId} {t("accepted the key")} ·{" "}
              {result.latencyMs ?? 0}ms
            </div>
          ) : result ? (
            <div className="verify err">
              ✗ {result.classification}
              {result.message ? ` · ${result.message}` : ""}
            </div>
          ) : null}
          {error ? <div className="verify err">✗ {error}</div> : null}

          <div className="modal-actions">
            <button className="secondary" onClick={onClose} disabled={busy}>
              {t("Cancel")}
            </button>
            <button
              className="secondary"
              onClick={() => void testNew()}
              disabled={busy || !secret.trim()}
            >
              {busy ? t("Testing…") : t("Test")}
            </button>
            <button
              onClick={() => void createAndVerify()}
              disabled={busy || !description.trim() || !secret.trim() || !agreed}
            >
              {busy ? t("Saving…") : t("Save key")}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
