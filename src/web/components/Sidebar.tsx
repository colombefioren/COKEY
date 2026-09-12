import type { ReactNode } from "react";
import { href, type Navigate } from "../router.js";

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

/**
 * Sidebar navigation.
 *
 * Every entry is a real anchor with a `#/path` href, so it is copyable,
 * middle-clickable and reachable by keyboard, and the browser back button does
 * what a user expects. There is no state to keep in sync: the route is the URL.
 */
export function Sidebar({
  groups,
  activePath,
  navigate,
  footer,
}: {
  groups: NavGroup[];
  activePath: string;
  navigate: Navigate;
  footer?: ReactNode;
}) {
  return (
    <aside className="sidebar">
      <a className="sidebar-brand" href={href("/dashboard")} onClick={() => navigate("/dashboard")}>
        <span className="brand-mark">CO</span>
        <span className="brand-word">KEY</span>
      </a>

      <nav className="sidebar-nav" aria-label="Sections">
        {groups.map((group) => (
          <div key={group.title} className="nav-group">
            <div className="nav-group-title">{group.title}</div>
            {group.items.map((item) => {
              const active = activePath === item.path;
              return (
                <a
                  key={item.path}
                  className={`nav-item${active ? " active" : ""}`}
                  href={href(item.path)}
                  aria-current={active ? "page" : undefined}
                  title={item.hint}
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
        <p className="sidebar-tagline">
          a tool for broke lads made by a broke princess
        </p>
      </div>
    </aside>
  );
}
