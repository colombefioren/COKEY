import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api.js";
import type { Nudge, ProviderStatus, PublicCredential, Settings as SettingsModel } from "./types.js";
import { ToastProvider } from "./components/Toast.js";
import { LiveStatus } from "./components/LiveStatus.js";
import { Sidebar, type NavGroup } from "./components/Sidebar.js";
import { LoginForm } from "./components/LoginForm.js";
import { href, useRoute } from "./router.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Chains } from "./pages/Chains.js";
import { Models } from "./pages/Models.js";
import { Providers } from "./pages/Providers.js";
import { ApiKeys } from "./pages/ApiKeys.js";
import { Usage } from "./pages/Usage.js";
import { Settings } from "./pages/Settings.js";
import { Tutorial } from "./pages/Tutorial.js";
import { Terms } from "./pages/Terms.js";
import { About } from "./pages/About.js";

const NUDGER_KEY = "cokey.nudger.dismissed";

/** The whole navigation, in one place, so the sidebar and the router agree. */
function navGroups(counts: { chains: number; keys: number; providers: number }): NavGroup[] {
  return [
    {
      title: "Overview",
      items: [
        { path: "/dashboard", label: "Dashboard", icon: "\u25C9", hint: "Gateway summary and live route" },
      ],
    },
    {
      title: "Configure",
      items: [
        {
          path: "/chains",
          label: "Chains",
          icon: "\u2726",
          hint: "Your failover chains, their nodes and their keys",
          badge: counts.chains ? String(counts.chains) : undefined,
        },
        { path: "/models", label: "Models", icon: "\u2699", hint: "Model catalog, live tests and rankings" },
        {
          path: "/providers",
          label: "Providers",
          icon: "\u25A4",
          hint: "Who runs each provider and whether to depend on it",
          badge: counts.providers ? String(counts.providers) : undefined,
        },
        { path: "/api-keys", label: "API keys", icon: "\u26BF", hint: "Keys for talking to the gateway itself" },
      ],
    },
    {
      title: "Observe",
      items: [
        {
          path: "/usage",
          label: "Usage",
          icon: "\u25A5",
          hint: "Request history and token usage together",
          badge: counts.keys ? String(counts.keys) : undefined,
        },
      ],
    },
    {
      title: "Help",
      items: [
        { path: "/settings", label: "Settings", icon: "\u2261", hint: "Gateway, fallback and egress settings" },
        { path: "/tutorial", label: "Tutorial", icon: "\u203A", hint: "Wire COKEY into your editor or CLI" },
        { path: "/terms", label: "Terms", icon: "\u00A7", hint: "What you agree to by using COKEY" },
        { path: "/about", label: "About", icon: "\u265E", hint: "The stack, the credits and how to reach the creator" },
      ],
    },
  ];
}

function Shell() {
  const { route, navigate } = useRoute();
  const [version, setVersion] = useState("");
  const [dataDir, setDataDir] = useState("");
  const [settings, setSettings] = useState<SettingsModel | null>(null);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [credentials, setCredentials] = useState<PublicCredential[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dismissed, setDismissed] = useState(() => window.localStorage.getItem(NUDGER_KEY) === "1");
  const [navOpen, setNavOpen] = useState(false);

  // The gateway always requires a session cookie, so the first authenticated
  // call decides whether to render the login form.
  const [authed, setAuthed] = useState<boolean | null>(null);

  const probe = useCallback(async () => {
    try {
      await api.settings();
      setAuthed(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthed(false);
        return;
      }
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  const reload = useCallback(async () => {
    if (authed !== true) return;
    try {
      const [health, settingsResult, nudgeResult, providerList, credentialList] = await Promise.all([
        api.health(),
        api.settings(),
        api.nudge(),
        api.allProviders(),
        api.allCredentials(),
      ]);
      setVersion(health.version);
      setDataDir(health.dataDir);
      setSettings(settingsResult);
      setNudge(nudgeResult);
      setProviders(providerList);
      setCredentials(credentialList);
    } catch {
      // The gateway may be restarting; the next poll picks it up.
    }
  }, [authed]);

  const bump = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  // Light polling so cooldowns and stats stay current, plus an immediate refresh
  // whenever the route changes.
  useEffect(() => {
    const timer = window.setInterval(() => void reload(), 10_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  useEffect(() => {
    setNavOpen(false);
    void reload();
  }, [route.path, reload]);

  if (authed === null) return null;
  if (!authed) {
    return <LoginForm onLogin={() => setAuthed(true)} />;
  }

  function dismissNudge() {
    window.localStorage.setItem(NUDGER_KEY, "1");
    setDismissed(true);
  }

  const groups = navGroups({
    chains: 0,
    keys: credentials.length,
    providers: providers.filter((provider) => provider.connected).length,
  });

  const page = renderPage(route.path, {
    refreshKey,
    bump,
    nudge: dismissed ? null : nudge,
    onDismissNudge: dismissNudge,
    settings,
    providers,
    credentials,
  });

  return (
    <div className={`shell${navOpen ? " nav-open" : ""}`}>
      <Sidebar
        groups={groups}
        activePath={route.path}
        navigate={navigate}
        footer={
          <div className="sidebar-stats">
            <span title="Connected providers">{providers.filter((p) => p.connected).length} providers</span>
            <span title="Stored credentials">{credentials.length} keys</span>
          </div>
        }
      />

      <div className="content">
        <header className="topbar">
          <button
            type="button"
            className="ghost nav-toggle"
            aria-label="Toggle navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((open) => !open)}
          >
            {"\u2630"}
          </button>
          <span className="topbar-title">{titleFor(route.path)}</span>
          <span className="spacer" />
          <LiveStatus />
          {version ? <span className="faint">v{version}</span> : null}
          {dataDir ? <span className="faint" title={dataDir}>data dir</span> : null}
          <a href={href("/tutorial")} onClick={() => navigate("/tutorial")} className="small">
            setup guide
          </a>
          <a href="/v1/models" target="_blank" rel="noreferrer" className="small">
            /v1/models
          </a>
        </header>

        <main>{page}</main>
      </div>
    </div>
  );
}

function titleFor(path: string): string {
  switch (path) {
    case "/chains":
      return "Chains";
    case "/models":
      return "Models";
    case "/providers":
      return "Providers";
    case "/api-keys":
      return "API keys";
    case "/usage":
      return "Usage";
    case "/settings":
      return "Settings";
    case "/tutorial":
      return "Tutorial";
    case "/terms":
      return "Terms of service";
    case "/about":
      return "About";
    default:
      return "Dashboard";
  }
}

interface PageContext {
  refreshKey: number;
  bump: () => void;
  nudge: Nudge | null;
  onDismissNudge: () => void;
  settings: SettingsModel | null;
  providers: ProviderStatus[];
  credentials: PublicCredential[];
}

function renderPage(path: string, context: PageContext) {
  switch (path) {
    case "/chains":
      return (
        <Chains
          refreshKey={context.refreshKey}
          onChanged={context.bump}
          providers={context.providers}
          credentials={context.credentials}
        />
      );
    case "/models":
      return <Models refreshKey={context.refreshKey} onChanged={context.bump} />;
    case "/providers":
      return <Providers refreshKey={context.refreshKey} onChanged={context.bump} />;
    case "/api-keys":
      return <ApiKeys refreshKey={context.refreshKey} onChanged={context.bump} />;
    case "/usage":
      return <Usage refreshKey={context.refreshKey} />;
    case "/settings":
      return (
        <Settings
          settings={context.settings}
          onSaved={context.bump}
          refreshKey={context.refreshKey}
        />
      );
    case "/tutorial":
      return <Tutorial />;
    case "/terms":
      return <Terms />;
    case "/about":
      return <About />;
    default:
      return (
        <Dashboard
          nudge={context.nudge}
          onDismissNudge={context.onDismissNudge}
          onGoToProviders={() => {
            window.location.hash = "#/providers";
          }}
          refreshKey={context.refreshKey}
        />
      );
  }
}

export function App() {
  return (
    <ToastProvider>
      <div className="starfield" aria-hidden="true" />
      <Shell />
    </ToastProvider>
  );
}
