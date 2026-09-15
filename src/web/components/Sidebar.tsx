import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { href, type Navigate } from "../router.js";
import { CokeyLogo, CokeyMark } from "./Logo.js";
import { IconChevron } from "./Icons.js";
import { SIDEBAR_TEXT, type Lang } from "../i18n.js";
import { useLang } from "../lang.js";

export const MOBILE_QUERY = "(max-width: 860px)";

export interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;

  hint: string;

  count?: number;
}

export function Sidebar({
  items,
  activePath,
  navigate,
  collapsed,
  onToggleCollapsed,
  keyCount,
  chainCount,
  mobileOpen,
  lang = "en",
}: {
  items: NavItem[];
  activePath: string;
  navigate: Navigate;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  keyCount: number;
  chainCount: number;

  mobileOpen: boolean;
  lang?: Lang;
}) {
  const text = SIDEBAR_TEXT[lang];
  const { t } = useLang();
  const navRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  const [glider, setGlider] = useState<{ top: number; height: number } | null>(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );

  const [hint, setHint] = useState<{ top: number; label: string } | null>(null);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const active = activeRef.current;
      if (!active) {
        setGlider(null);
        return;
      }
      setGlider({ top: active.offsetTop, height: active.offsetHeight });
    };
    measure();

    window.addEventListener("resize", measure);

    const observer = new ResizeObserver(measure);
    if (navRef.current) observer.observe(navRef.current);

    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [activePath, collapsed, items.length]);

  useEffect(() => {
    if (!collapsed) setHint(null);
  }, [collapsed]);

  const showHint = (label: string) => (event: { currentTarget: HTMLAnchorElement }) => {
    if (!collapsed || isMobile) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const row = event.currentTarget.getBoundingClientRect();
    const base = sidebar.getBoundingClientRect();
    setHint({ top: row.top - base.top + row.height / 2, label });
  };

  const hidden = isMobile && !mobileOpen;

  const inertProps = { inert: hidden || undefined } as React.HTMLAttributes<HTMLElement>;

  const effectiveCollapsed = collapsed && !isMobile;

  return (
    <aside
      ref={sidebarRef}
      className={`sidebar${effectiveCollapsed ? " collapsed" : ""}`}
      onMouseLeave={() => setHint(null)}
      {...inertProps}
    >
      <a
        className="sidebar-brand"
        href={href("/dashboard")}
        onClick={() => navigate("/dashboard")}
        aria-label={t("COKEY dashboard")}
      >
        {effectiveCollapsed ? (
          <CokeyMark height={30} className="brand-logo" />
        ) : (
          <CokeyLogo height={30} withWordmark uid="sidebar-brand" className="brand-logo" />
        )}
      </a>

      <nav className="sidebar-nav" ref={navRef} aria-label={t("Sections")}>
        {glider ? (
          <div
            className="nav-glider"
            style={{ transform: `translateY(${glider.top}px)`, height: glider.height }}
            aria-hidden="true"
          />
        ) : null}

        {items.map((item, index) => {
          const isActive = item.path === activePath;
          return (
            <a
              key={item.path}
              ref={isActive ? activeRef : undefined}
              className={`nav-item${isActive ? " active" : ""}`}
              href={href(item.path)}
              data-tour={`nav-${item.path.replace(/^\//, "").replace(/\//g, "-")}`}
              title={item.hint}
              aria-label={effectiveCollapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              style={{ "--nav-index": index } as React.CSSProperties}
              onMouseEnter={showHint(item.label)}
              onFocus={showHint(item.label)}
              onBlur={() => setHint(null)}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
              {item.count ? <span className="nav-badge">{item.count}</span> : null}
            </a>
          );
        })}
      </nav>

      {effectiveCollapsed && hint ? (
        <span className="nav-hint" style={{ top: hint.top }} aria-hidden="true">
          {hint.label}
        </span>
      ) : null}

      {isMobile ? null : (
        <button
          type="button"
          className="sidebar-fold"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? text.expand : text.collapse}
          title={collapsed ? text.expand : text.collapse}
        >
          <IconChevron size={14} />
        </button>
      )}

      <div className="sidebar-foot">
        <div className="sidebar-stats">
          <span>
            {chainCount} {text.chains}
          </span>
          <span>
            {keyCount} {text.keys}
          </span>
        </div>
        <p className="sidebar-tagline">{text.tagline}</p>
      </div>
    </aside>
  );
}
