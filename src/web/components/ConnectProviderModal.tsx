import { useState } from "react";
import { api } from "../api.js";
import { href } from "../router.js";
import type { ProviderStatus, ValidationResult } from "../types.js";
import { Modal } from "./Primitives.js";
import { useToast } from "./Toast.js";
import { useLang } from "../lang.js";

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
  const { t } = useLang();
  const [description, setDescription] = useState("");
  const [secret, setSecret] = useState("");
  const [accountId, setAccountId] = useState("");
  const [useProxy, setUseProxy] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ValidationResult | undefined>();
  const [error, setError] = useState<string | undefined>();

  const needsAccountId = provider.credentialFields.includes("accountId");
  const hasFields = Boolean(
    description.trim() && secret.trim() && (!needsAccountId || accountId.trim()),
  );

  async function test() {
    if (!hasFields) {
      setError(
        needsAccountId
          ? t("Description, key and account id are required")
          : t("Description and key are both required"),
      );
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
      setError(
        needsAccountId
          ? t("Description, key and account id are required")
          : t("Description and key are both required"),
      );
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
      const response = await api.connectProvider(provider.id, {
        description: description.trim(),
        secret: secret.trim(),
        ...(needsAccountId ? { accountId: accountId.trim() } : {}),
        saveAnyway: true,
        useProxy,
      });
      setResult(response.validation);

      // Saving a key is also the first moment this provider can be asked what it
      // serves, so the confirmation reports the model list rather than making
      // the user go and find out.
      const found = response.models;
      const modelNote =
        found && found.ok
          ? ` · ${found.discovered} ${t("models")}${found.removed.length ? `, ${found.removed.length} ${t("retired")}` : ""}`
          : found?.message
            ? ` · ${t("model list")}: ${found.message}`
            : "";

      toast.ok(
        (response.validation.ok
          ? `${provider.displayName} ${t("key verified in")} ${response.validation.latencyMs ?? 0}ms`
          : `${provider.displayName} ${t("key saved")} (${response.validation.classification})`) +
          modelNote,
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
      title={`${t("Connect")} ${provider.displayName}`}
      subtitle={`${provider.freeTier.summary} · ${t("the key never leaves this machine")}`}
      onClose={onClose}
    >
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
        <label htmlFor="connect-description">{t("Description")}</label>
        <input
          id="connect-description"
          value={description}
          placeholder={t("Main account, Personal backup, Second account…")}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="connect-secret">{t("API key")}</label>
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
          <label htmlFor="connect-account">{t("Account id")}</label>
          <input
            id="connect-account"
            value={accountId}
            placeholder={t("Cloudflare account id")}
            onChange={(event) => setAccountId(event.target.value)}
          />
        </div>
      ) : null}

      {result ? (
        <div className={`verify ${result.ok ? "ok" : "err"}`}>
          {result.ok
            ? `✓ ${t("Verified")} · ${provider.displayName} ${t("accepted the key")} · ${result.latencyMs ?? 0}ms`
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
        {t("Route this test/save through the egress pool")}
        <span className="small faint" style={{ display: "block", marginLeft: 22 }}>
          {t(
            "Protects your real IP, but free pool exits can hang, error or get blocked — no proxy is faster. Off = direct.",
          )}
        </span>
      </label>

      <div className="hint-box" style={{ marginTop: 14 }}>
        {t("Need a key?")}{" "}
        <a href={provider.signupUrl} target="_blank" rel="noreferrer">
          {t("Open")} {provider.displayName} ↗
        </a>
      </div>

      <div className="modal-actions">
        <button className="secondary" onClick={onClose} disabled={busy}>
          {t("Cancel")}
        </button>
        <button className="secondary" onClick={() => void test()} disabled={busy || !secret.trim()}>
          {busy ? t("Testing…") : t("Test")}
        </button>
        <button onClick={() => void save()} disabled={busy || !hasFields || !agreed}>
          {busy ? t("Saving…") : t("Save key")}
        </button>
      </div>
    </Modal>
  );
}
