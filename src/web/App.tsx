import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "./api.js";
import type {
  Nudge,
  ProviderStatus,
  PublicCredential,
  Settings as SettingsModel,
} from "./types.js";
import { ToastProvider } from "./components/Toast.js";
import { LiveStatus } from "./components/LiveStatus.js";
import { LoginForm } from "./components/LoginForm.js";
import { NotificationsBell } from "./components/NotificationsBell.js";
import { Insights } from "./components/Insights.js";
import { KineticText } from "./components/KineticText.js";
import { Sidebar, type NavItem } from "./components/Sidebar.js";
import { StatusBar } from "./components/StatusBar.js";
import { Tour, TOUR_SEEN_KEY } from "./components/Tour.js";
import {
  IconActivity,
  IconBook,
  IconCompass,
  IconGauge,
  IconGrid,
  IconKey,
  IconLayers,
  IconMenu,
  IconRoute,
  IconScroll,
  IconShield,
  IconSliders,
  IconSparkle,
} from "./components/Icons.js";
import { useRoute } from "./router.js";
import { NAV_HINTS, PAGE_TITLES, type Lang } from "./i18n.js";
import { LangProvider, useLang } from "./lang.js";
import { useLive, useLiveInvalidation } from "./live.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Chains } from "./pages/Chains.js";
import { Models } from "./pages/Models.js";
import { Providers } from "./pages/Providers.js";
import { ApiKeys } from "./pages/ApiKeys.js";
import { Usage } from "./pages/Usage.js";
import { Settings } from "./pages/Settings.js";
import { Proxies } from "./pages/Proxies.js";
import { Tutorial } from "./pages/Tutorial.js";
import { Terms } from "./pages/Terms.js";
import { About } from "./pages/About.js";

const NUDGER_KEY = "cokey.nudger.dismissed";

const NAV_COLLAPSED_KEY = "cokey.nav.collapsed";

function navItems(
  counts: { chains: number; keys: number; providers: number },
  lang: Lang,
): NavItem[] {
  const titles = PAGE_TITLES[lang];
  const hints = NAV_HINTS[lang];
  return [
    { path: "/dashboard", icon: <IconGauge size={18} /> },
    { path: "/chains", icon: <IconRoute size={18} />, count: counts.chains || undefined },
    { path: "/models", icon: <IconSparkle size={18} /> },
    { path: "/providers", icon: <IconGrid size={18} />, count: counts.providers || undefined },
    { path: "/api-keys", icon: <IconKey size={18} /> },
    { path: "/usage", icon: <IconActivity size={18} />, count: counts.keys || undefined },
    { path: "/settings", icon: <IconSliders size={18} /> },
    { path: "/proxies", icon: <IconShield size={18} /> },
    { path: "/tutorial", icon: <IconBook size={18} /> },
    { path: "/terms", icon: <IconScroll size={18} /> },
    { path: "/about", icon: <IconLayers size={18} /> },
  ].map((item) => ({
    ...item,
    label: item.path === "/terms" ? (lang === "fr" ? "Conditions" : "Terms") : titles[item.path]!,
    hint: hints[item.path]!,
  }));
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
  const [navCollapsed, setNavCollapsed] = useState(
    () => window.localStorage.getItem(NAV_COLLAPSED_KEY) === "1",
  );
  const [navOpen, setNavOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const { lang, toggleLang, t } = useLang();

  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    if (authed !== true) return;
    if (window.localStorage.getItem(TOUR_SEEN_KEY) === "1") return;
    const timer = window.setTimeout(() => setTourOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [authed]);

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
    } catch {}
  }, [authed]);

  const bump = useCallback(() => setRefreshKey((value) => value + 1), []);

  const live = useLive();
  useLiveInvalidation(bump);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  useEffect(() => {
    const timer = window.setInterval(() => void reload(), 60_000);
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

  const items = useMemo(() => navItems(counts, lang), [counts, lang]);

  const toggleNavCollapsed = useCallback(() => {
    setNavCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [route.path]);

  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  const closeNav = useCallback(
    (path: string) => {
      navigate(path);
      setNavOpen(false);
    },
    [navigate],
  );

  if (authed === null) return null;
  if (!authed) {
    return <LoginForm onLogin={() => setAuthed(true)} />;
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
    <div className={`shell${navOpen ? " nav-open" : ""}${navCollapsed ? " nav-collapsed" : ""}`}>
      <Sidebar
        items={items}
        activePath={route.path}
        navigate={closeNav}
        collapsed={navCollapsed}
        onToggleCollapsed={toggleNavCollapsed}
        keyCount={counts.keys}
        chainCount={counts.chains}
        mobileOpen={navOpen}
        lang={lang}
      />
      {navOpen ? (
        <div className="nav-backdrop" aria-hidden="true" onClick={() => setNavOpen(false)} />
      ) : null}

      <div className="content">
        <header className="topbar">
          <button
            type="button"
            className="nav-toggle"
            aria-label={navOpen ? t("Close navigation") : t("Open navigation")}
            onClick={() => setNavOpen((value) => !value)}
          >
            <IconMenu size={17} />
          </button>
          <KineticText
            className="topbar-title"
            key={route.path}
            text={PAGE_TITLES[lang][route.path] ?? PAGE_TITLES[lang]["/dashboard"]}
          />
          <span className="spacer" />
          <button
            type="button"
            className="lang-toggle"
            onClick={toggleLang}
            aria-label={lang === "en" ? "Switch to French" : "Passer en anglais"}
            title={lang === "en" ? "Switch to French" : "Passer en anglais"}
          >
            <span className={lang === "en" ? "active" : undefined}>EN</span>
            <span className={lang === "fr" ? "active" : undefined}>FR</span>
          </button>
          <button
            type="button"
            className="guide-toggle"
            data-tour="guide-button"
            onClick={() => setTourOpen(true)}
            aria-label={t("Replay the guided tour")}
            title={t("Replay the guided tour")}
          >
            <IconCompass size={17} />
            <span className="guide-label">{t("Guide")}</span>
          </button>
          <NotificationsBell refreshKey={refreshKey} onChanged={bump} />
          <LiveStatus />
          <a
            href="/v1/models"
            target="_blank"
            rel="noreferrer"
            className="topbar-link mono"
            data-tour="v1-models-link"
            title={t("The public model list, as any OpenAI client would see it")}
          >
            /v1/models
          </a>
        </header>

        <Insights />
        <Tour
          open={tourOpen}
          onClose={() => setTourOpen(false)}
          currentPath={route.path}
          navigate={navigate}
          onRequestNavOpen={setNavOpen}
        />

        {}
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
            live={live.connected}
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
    case "/proxies":
      return (
        <Proxies
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
    <LangProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </LangProvider>
  );
}
