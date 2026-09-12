import type { ReactNode } from "react";
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
        <CokeyLogo height={24} className="brand-logo" />
        <span className="sr-only">COKEY dashboard</span>
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

        <div className="creator-card">
          <div className="creator-line">
            made by <a href={CREATOR.github} target="_blank" rel="noreferrer">@{CREATOR.name}</a>
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
    </aside>
  );
}
