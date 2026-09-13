import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { href, type Navigate } from "../router.js";
import { CokeyLogo, CokeyMark } from "./Logo.js";
import { IconChevron } from "./Icons.js";
import { SIDEBAR_TEXT, type Lang } from "../i18n.js";

/** Must match the sidebar-becomes-a-drawer breakpoint in responsive.css. */
const MOBILE_QUERY = "(max-width: 860px)";

export interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
  /** Tooltip: what this section is for. */
  hint: string;
  /** Optional count, in the current section's units. */
  count?: number;
}

/**
 * The primary navigation, as a left rail.
 *
 * Every item is a real anchor with a `#/path` href, so it is copyable,
 * middle-clickable and reachable by keyboard, and the browser's back button
 * does what a user expects. The highlight behind the active item is one
 * element that glides between anchors rather than each item toggling its own
 * background, which is what makes the column read as one moving object.
 *
 * The brand is the drawn lockup, not the word "COKEY" set in a font: the mark
 * and the lettering share one pink-to-violet stroke, and typesetting half of it
 * would break that. Folded, only the mark fits, so only the mark is shown.
 *
 * On a narrow screen the rail becomes a slide-in drawer, toggled by the
 * hamburger button in the topbar (`.shell.nav-open`, handled in App.tsx).
 */
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
  /** Whether the mobile drawer is currently open. Ignored above the breakpoint. */
  mobileOpen: boolean;
  lang?: Lang;
}) {
  const text = SIDEBAR_TEXT[lang];
  const navRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  const [glider, setGlider] = useState<{ top: number; height: number } | null>(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );
  /**
   * The label that floats out of a folded row on hover.
   *
   * Folded, every row is an icon, and an icon set alone is a memory test. The
   * label cannot simply be positioned inside the row because the nav column
   * scrolls, and a scroll container clips its overflow — so the name is drawn
   * once, in the rail's own coordinate space, at the height of whatever row is
   * under the cursor.
   */
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
    // A text-zoom or font change can resize nav rows without touching any of
    // the other dependencies below, so the glider still needs to catch it.
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activePath, collapsed, items.length]);

  // A folded rail is the only place the float-out label exists, so leaving the
  // rail or unfolding it has to take the label with it.
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

  // Below the breakpoint the drawer is only ever a transform away, so its
  // links stay in the tab order and screen-reader tree unless explicitly
  // retired while closed.
  const hidden = isMobile && !mobileOpen;
  // `inert` is a real DOM boolean attribute React forwards as-is, but the
  // installed @types/react predates its addition to the JSX typings.
  const inertProps = { inert: hidden || undefined } as React.HTMLAttributes<HTMLElement>;

  return (
    <aside
      ref={sidebarRef}
      className={`sidebar${collapsed ? " collapsed" : ""}`}
      onMouseLeave={() => setHint(null)}
      {...inertProps}
    >
      <a
        className="sidebar-brand"
        href={href("/dashboard")}
        onClick={() => navigate("/dashboard")}
        aria-label="COKEY dashboard"
      >
        {collapsed ? (
          <CokeyMark height={30} className="brand-logo" />
        ) : (
          <CokeyLogo height={30} withWordmark uid="sidebar-brand" className="brand-logo" />
        )}
      </a>

      <nav className="sidebar-nav" ref={navRef} aria-label="Sections">
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
              title={item.hint}
              aria-label={collapsed ? item.label : undefined}
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

      {collapsed && hint ? (
        <span className="nav-hint" style={{ top: hint.top }} aria-hidden="true">
          {hint.label}
        </span>
      ) : null}

      <button
        type="button"
        className="sidebar-fold"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? text.expand : text.collapse}
        title={collapsed ? text.expand : text.collapse}
      >
        <IconChevron size={14} />
      </button>

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
