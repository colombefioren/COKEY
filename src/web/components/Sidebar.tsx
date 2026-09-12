import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { href, type Navigate } from "../router.js";
import { CokeyLogo } from "./Logo.js";
import { CREATOR, REPO_URL } from "../links.js";

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  hint: string;
  /** Optional badge text, for example a credential count. */
  badge?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Where the highlight should sit, measured from the active anchor. */
interface Glider {
  top: number;
  height: number;
}

/**
 * Sidebar navigation.
 *
 * Every entry is a real anchor with a `#/path` href, so it is copyable,
 * middle-clickable and reachable by keyboard, and the browser back button does
 * what a user expects. There is no state to keep in sync: the route is the URL.
 *
 * The only thing measured is the highlight. One element glides between items
 * rather than each item blinking, which is what makes the column read as a
 * single moving object. It is positioned before paint, so there is no frame in
 * which the current page looks unselected.
 */
const COLLAPSE_KEY = "cokey.nav.collapsed";

export function Sidebar({
  groups,
  activePath,
  navigate,
  footer,
  onClose,
}: {
  groups: NavGroup[];
  activePath: string;
  navigate: Navigate;
  footer?: ReactNode;
  onClose?: () => void;
}) {
  const navRef = useRef<HTMLElement | null>(null);
  const [glider, setGlider] = useState<Glider | null>(null);
  const [collapsed, setCollapsed] = useState(
    () => window.localStorage.getItem(COLLAPSE_KEY) === "1",
  );

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // The shell rebuilds `groups` on every render, so the effect cannot depend on
  // the array itself without re-measuring forever. A content signature is a
  // primitive and only changes when the navigation actually changes.
  const signature = useMemo(
    () =>
      groups
        .map((group) => `${group.title}:${group.items.map((item) => item.path).join(",")}`)
        .join("|"),
    [groups],
  );

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const measure = () => {
      const active = nav.querySelector<HTMLElement>(".nav-item.active");
      if (!active) {
        setGlider(null);
        return;
      }
      const next: Glider = { top: active.offsetTop, height: active.offsetHeight };
      setGlider((current) =>
        current && current.top === next.top && current.height === next.height ? current : next,
      );
    };

    measure();
    // Web fonts land after first paint and can nudge a row's height.
    void document.fonts?.ready.then(measure).catch(() => undefined);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activePath, signature]);

  // Keep the drawer honest: Escape closes it, the way every other overlay does.
  useEffect(() => {
    if (!onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  let index = 0;

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <button
        type="button"
        className="sidebar-fold"
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((value) => !value)}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M10 3.5 5.5 8l4.5 4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <a className="sidebar-brand" href={href("/dashboard")} onClick={() => navigate("/dashboard")}>
        <CokeyLogo height={24} className="brand-logo" />
        <span className="sr-only">COKEY dashboard</span>
      </a>

      <nav className="sidebar-nav" aria-label="Sections" ref={navRef}>
        {glider ? (
          <span
            className="nav-glider"
            aria-hidden="true"
            style={{ transform: `translateY(${glider.top}px)`, height: glider.height }}
          />
        ) : null}

        {groups.map((group) => (
          <div key={group.title} className="nav-group">
            <div className="nav-group-title">{group.title}</div>
            {group.items.map((item) => {
              const active = activePath === item.path;
              const order = index;
              index += 1;
              return (
                <a
                  key={item.path}
                  className={`nav-item${active ? " active" : ""}`}
                  href={href(item.path)}
                  aria-current={active ? "page" : undefined}
                  title={item.hint}
                  style={{ "--nav-index": order } as CSSProperties}
                  onClick={() => navigate(item.path)}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="nav-label">{item.label}</span>
                  {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        {footer}

        <div className="creator-card">
          <div className="creator-line">
            made by{" "}
            <a href={CREATOR.github} target="_blank" rel="noreferrer">
              @{CREATOR.name}
            </a>
          </div>
          <div className="creator-links">
            <a href={CREATOR.github} target="_blank" rel="noreferrer" title="GitHub">
              GitHub
            </a>
            <a href={CREATOR.linkedin} target="_blank" rel="noreferrer" title="LinkedIn">
              LinkedIn
            </a>
            <a href={CREATOR.facebook} target="_blank" rel="noreferrer" title="Facebook">
              Facebook
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" title="Source code">
              Source
            </a>
          </div>
        </div>

        <p className="sidebar-tagline">a tool for broke lads made by a broke princess</p>
      </div>

      {onClose ? (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={onClose}
        />
      ) : null}
    </aside>
  );
}
