import { useState } from "react";

interface Props {
  /** The token injected by the server (empty string when no auth is configured). */
  serverToken: string;
  onLogin: (token: string) => void;
}

/**
 * Full-screen login form shown when an auth token is configured but the
 * browser session doesn't have one stored yet.
 *
 * The server injects the current token into the HTML — the form is pre-filled
 * with it so the user just clicks "Login" on first visit. After a token
 * rotation in Settings, localStorage is cleared and the login form reappears.
 *
 * Once a token is configured it stays configured — there is no UI path to
 * return to open (no-auth) mode. Use `cokey keys delete` or restart the server
 * without COKEY_AUTH_TOKEN to go back to open mode from the CLI.
 */
export function LoginForm({ serverToken, onLogin }: Props) {
  const [value, setValue] = useState(serverToken);
  const [busy, setBusy] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setBusy(true);
    setTimeout(() => {
      onLogin(trimmed);
      setBusy(false);
    }, 50);
  }

  return (
    <div className="login">
      <div className="login-card">
        <h1>COKEY</h1>
        <p className="subtitle">Authenticate with the management API token</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="auth-token-input">Bearer token</label>
          <input
            id="auth-token-input"
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
            style={{ fontFamily: "monospace" }}
          />
          <div className="small faint" style={{ marginTop: 8, marginBottom: 12 }}>
            Set <code>COKEY_AUTH_TOKEN</code> when starting the gateway, or generate one with{" "}
            <code>cokey keys create</code>.
          </div>
          <button type="submit" disabled={busy || !value.trim()}>
            {busy ? "Logging in…" : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
