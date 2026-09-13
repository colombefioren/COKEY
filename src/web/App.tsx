import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "./api.js";
import type { Nudge, ProviderStatus, PublicCredential, Settings as SettingsModel } from "./types.js";
import { ToastProvider } from "./components/Toast.js";
import { LiveStatus } from "./components/LiveStatus.js";
import { LoginForm } from "./components/LoginForm.js";
import { ThemeToggle } from "./components/ThemeToggle.js";
import { BookmarkTabs, type BookmarkItem } from "./components/BookmarkTabs.js";
import { StatusBar } from "./components/StatusBar.js";
import {
  PixelChart,
  PixelFolder,
  PixelHeart,
  PixelInfo,
  PixelLock,
  PixelPlug,
  PixelScroll,
  PixelServer,
  PixelStar,
  PixelWrench,
} from "./components/PixelIcons.js";
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

/** Page titles, in one place so the title bar and the router agree. */
const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/chains": "Chains",
  "/models": "Models",
  "/providers": "Providers",
  "/api-keys": "API keys",
  "/usage": "Usage",
  "/settings": "Settings",
  "/tutorial": "Tutorial",
  "/terms": "Terms of service",
  "/about": "About",
};

/**
 * The whole navigation, in one place.
 *
 * Ten sections is the most a bookmark row can carry before it becomes a menu,
 * and it is the reason the row collapses to a native picker on a phone rather
 * than scrolling horizontally out of reach.
 */
function bookmarks(counts: { chains: number; keys: number; providers: number }): BookmarkItem[] {
  return [
    {
      path: "/dashboard",
      label: "Dashboard",
      icon: <PixelFolder />,
      hint: "Gateway summary, the live route and the resilience layers",
    },
    {
      path: "/chains",
      label: "Chains",
      icon: <PixelServer />,
      hint: "Your failover chains, their nodes and their keys",
      count: counts.chains || undefined,
    },
    {
      path: "/models",
      label: "Models",
      icon: <PixelStar />,
      hint: "Model catalog, live probes and rankings",
    },
    {
      path: "/providers",
      label: "Providers",
      icon: <PixelPlug />,
      hint: "Who runs each provider and whether to depend on it",
      count: counts.providers || undefined,
    },
    {
      path: "/api-keys",
      label: "API keys",
      icon: <PixelLock />,
      hint: "Keys for talking to the gateway itself",
    },
    {
      path: "/usage",
      label: "Usage",
      icon: <PixelChart />,
      hint: "Request history and token usage together",
      count: counts.keys || undefined,
    },
    {
      path: "/settings",
      label: "Settings",
      icon: <PixelWrench />,
      hint: "Gateway, fallback and egress settings",
    },
    {
      path: "/tutorial",
      label: "Tutorial",
      icon: <PixelScroll />,
      hint: "Wire COKEY into your editor or CLI",
    },
    {
      path: "/terms",
      label: "Terms",
      icon: <PixelInfo />,
      hint: "What you agree to by using COKEY",
    },
    {
      path: "/about",
      label: "About",
      icon: <PixelHeart />,
      hint: "The stack, the credits and how to reach the creator",
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
  const [chainCount, setChainCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dismissed, setDismissed] = useState(() => window.localStorage.getItem(NUDGER_KEY) === "1");

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
      const [health, settingsResult, nudgeResult, providerList, credentialList, chainList] =
        await Promise.all([
          api.health(),
          api.settings(),
          api.nudge(),
          api.allProviders(),
          api.allCredentials(),
          api.chains(),
        ]);
      setVersion(health.version);
      setDataDir(health.dataDir);
      setSettings(settingsResult);
      setNudge(nudgeResult);
      setProviders(providerList);
      setCredentials(credentialList);
      setChainCount(chainList.length);
    } catch {
      // The gateway may be restarting; the next refresh picks it up.
    }
  }, [authed]);

  /**
   * Ask every page to refetch.
   *
   * This is what the live event stream calls the moment the gateway reports a
   * change, so there is no polling interval to tune and nothing goes stale:
   * a key that verifies in one tab updates the counts in another.
   */
  const bump = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  // Expiring cooldowns and throughput buckets change without an event, so a
  // slow heartbeat keeps the gauges honest. Everything else is event-driven.
  useEffect(() => {
    const timer = window.setInterval(() => void reload(), 20_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  useEffect(() => {
    void reload();
  }, [route.path, reload]);

  const counts = useMemo(
    () => ({
      chains: chainCount,
      keys: credentials.length,
      providers: providers.filter((provider) => provider.connected).length,
    }),
    [chainCount, credentials.length, providers],
  );

  const items = useMemo(() => bookmarks(counts), [counts]);

  if (authed === null) return null;
  if (!authed) {
    return (
      <>
        <ThemeToggle className="login-theme" />
        <LoginForm onLogin={() => setAuthed(true)} />
      </>
    );
  }

  function dismissNudge() {
    window.localStorage.setItem(NUDGER_KEY, "1");
    setDismissed(true);
  }

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
    <div className="shell">
      <div className="content">
        <div className="chrome-stack">
          <header className="topbar">
            <a className="topbar-brand" href={href("/dashboard")} onClick={() => navigate("/dashboard")}>
              COKEY
            </a>
            <span className="faint small topbar-title" key={route.path}>
              {TITLES[route.path] ?? "Dashboard"}
            </span>
            <span className="spacer" />
            <LiveStatus />
            <a href="/v1/models" target="_blank" rel="noreferrer" className="small">
              /v1/models
            </a>
            <ThemeToggle />
          </header>

          <BookmarkTabs items={items} activePath={route.path} navigate={navigate} />
        </div>

        {/*
         * Keyed on the route so each page remounts: the windows pop in on a real
         * navigation, and the pages already refetch on mount.
         */}
        <main>
          <div className="page" key={route.path}>
            {page}
          </div>

          <StatusBar
            version={version}
            dataDir={dataDir}
            providers={counts.providers}
            keys={counts.keys}
            chains={counts.chains}
          />
        </main>
      </div>
    </div>
  );
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
