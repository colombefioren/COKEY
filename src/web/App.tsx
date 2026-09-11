import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import type { Nudge, ProviderStatus, PublicCredential, Settings as SettingsModel } from "./types.js";
import { ToastProvider } from "./components/Toast.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Chains } from "./pages/Chains.js";
import { AddChain } from "./pages/AddChain.js";
import { Providers } from "./pages/Providers.js";
import { Keys } from "./pages/Keys.js";
import { Requests } from "./pages/Requests.js";
import { Settings } from "./pages/Settings.js";

type Tab = "dashboard" | "chains" | "add" | "providers" | "keys" | "requests" | "settings";

const TABS: Array<[Tab, string]> = [
  ["dashboard", "Dashboard"],
  ["chains", "Chains"],
  ["add", "Add chain"],
  ["providers", "Providers"],
  ["keys", "Keys"],
  ["requests", "Requests"],
  ["settings", "Settings"],
];

const NUDGER_KEY = "cokey.nudger.dismissed";

function Shell() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [version, setVersion] = useState("");
  const [dataDir, setDataDir] = useState("");
  const [settings, setSettings] = useState<SettingsModel | null>(null);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [credentials, setCredentials] = useState<PublicCredential[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dismissed, setDismissed] = useState(
    () => window.localStorage.getItem(NUDGER_KEY) === "1",
  );

  const reload = useCallback(async () => {
    try {
      const [health, settingsResult, nudgeResult, providerList, credentialList] = await Promise.all([
        api.health(),
        api.settings(),
        api.nudge(),
        api.providers(),
        api.credentials(),
      ]);
      setVersion(health.version);
      setDataDir(health.dataDir);
      setSettings(settingsResult);
      setNudge(nudgeResult);
      setProviders(providerList);
      setCredentials(credentialList);
    } catch {
      // The gateway may be restarting; the next poll will pick it up.
    }
  }, []);

  const bump = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  // Light polling so credential cooldowns and stats stay current.
  useEffect(() => {
    const timer = window.setInterval(() => void reload(), 10_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  function dismissNudge() {
    window.localStorage.setItem(NUDGER_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          CO<span>KEY</span>
        </div>
        <nav className="tabs">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              className="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="topbar-meta">
          <span>● running</span>
          {version ? <span>v{version}</span> : null}
          {dataDir ? <span title={dataDir}>{dataDir}</span> : null}
          <a href="/v1/models" target="_blank" rel="noreferrer">
            /v1/models ↗
          </a>
        </div>
      </header>

      <main>
        {tab === "dashboard" ? (
          <Dashboard
            nudge={dismissed ? null : nudge}
            onDismissNudge={dismissNudge}
            onGoToProviders={() => setTab("providers")}
            refreshKey={refreshKey}
          />
        ) : null}

        {tab === "chains" ? <Chains refreshKey={refreshKey} onChanged={bump} /> : null}

        {tab === "add" ? (
          <AddChain
            providers={providers}
            credentials={credentials}
            onCreated={() => {
              bump();
              setTab("chains");
            }}
          />
        ) : null}

        {tab === "providers" ? <Providers refreshKey={refreshKey} onChanged={bump} /> : null}

        {tab === "keys" ? <Keys refreshKey={refreshKey} onChanged={bump} /> : null}

        {tab === "requests" ? <Requests refreshKey={refreshKey} /> : null}

        {tab === "settings" ? (
          <Settings settings={settings} onSaved={bump} refreshKey={refreshKey} />
        ) : null}
      </main>
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
