import { useState } from "react";
import { api, ApiError } from "../api.js";
import { CokeyLogo } from "./Logo.js";
import { useLang } from "../lang.js";

/**
 * Full-screen password gate.
 *
 * The server requires a session cookie for every `/api/*` call. The form posts
 * the admin password once and the cookie keeps the user signed in until it
 * expires or the gateway restarts.
 */
export function LoginForm({ onLogin }: { onLogin: () => void }) {
  const { t } = useLang();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(undefined);
    try {
      await api.login(password);
      onLogin();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <CokeyLogo height={48} className="login-mark" uid="login" />
        <p className="subtitle">{t("Sign in to manage the gateway")}</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="password-input">{t("Password")}</label>
          <input
            id="password-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
          />
          <div className="small faint" style={{ marginTop: 8, marginBottom: 12 }}>
            {t("Default")} <code>coco-the-best</code> —{" "}
            {t("change it in Settings and it is permanent.")}
          </div>
          {error ? <div className="verify err">{error}</div> : null}
          <button type="submit" disabled={busy || !password}>
            {busy ? t("Signing in…") : t("Sign in")}
          </button>
        </form>
      </div>
    </div>
  );
}
