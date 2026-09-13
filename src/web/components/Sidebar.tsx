import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { href, type Navigate } from "../router.js";
import { CokeyLogo } from "./Logo.js";
import { IconChevron } from "./Icons.js";

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
}) {
  const navRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  const [glider, setGlider] = useState<{ top: number; height: number } | null>(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );

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

  // Below the breakpoint the drawer is only ever a transform away, so its
  // links stay in the tab order and screen-reader tree unless explicitly
  // retired while closed.
  const hidden = isMobile && !mobileOpen;
  // `inert` is a real DOM boolean attribute React forwards as-is, but the
  // installed @types/react predates its addition to the JSX typings.
  const inertProps = { inert: hidden || undefined } as React.HTMLAttributes<HTMLElement>;

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`} {...inertProps}>
      <a className="sidebar-brand" href={href("/dashboard")} onClick={() => navigate("/dashboard")}>
        <CokeyLogo height={26} withWordmark={false} uid="sidebar-mark" className="brand-logo" />
        <span className="brand-word">COKEY</span>
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
              aria-current={isActive ? "page" : undefined}
              style={{ "--nav-index": index } as React.CSSProperties}
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

      <button
        type="button"
        className="sidebar-fold"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <IconChevron size={14} />
      </button>

      <div className="sidebar-foot">
        <div className="sidebar-stats">
          <span>{chainCount} chains</span>
          <span>{keyCount} keys</span>
        </div>
        <p className="sidebar-tagline">a tool for broke lads made by a broke princess</p>
      </div>
    </aside>
  );
}
