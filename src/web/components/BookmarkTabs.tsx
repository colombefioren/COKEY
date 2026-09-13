import type { ReactNode } from "react";
import { href, type Navigate } from "../router.js";

export interface BookmarkItem {
  path: string;
  label: string;
  /** A pixel icon, sized 14-16px by the stylesheet. */
  icon: ReactNode;
  /** Tooltip: what this section is for. */
  hint: string;
  /** Optional count, in the current section's units. */
  count?: number;
}

/**
 * The primary navigation, as browser bookmark tabs.
 *
 * Every tab is a real anchor with a `#/path` href, so it is copyable,
 * middle-clickable and reachable by keyboard, and the browser's back button does
 * what a user expects. There is no state to synchronise: the route is the URL.
 *
 * The tabs are cut at an angle with `clip-path`, which is why the stylesheet
 * draws their outline as a hard drop-shadow rather than a border — a clipped
 * element cannot carry one. Below 720px ten clipped tabs stop fitting a phone,
 * so the row is replaced by a native select, which is the one control that gets
 * a mobile picker right on every platform.
 */
export function BookmarkTabs({
  items,
  activePath,
  navigate,
}: {
  items: BookmarkItem[];
  activePath: string;
  navigate: Navigate;
}) {
  const active = items.find((item) => item.path === activePath) ?? items[0];

  return (
    <>
      <nav className="bookmarks" aria-label="Sections">
        {items.map((item) => {
          const isActive = item.path === activePath;
          return (
            <a
              key={item.path}
              className={`bookmark${isActive ? " active" : ""}`}
              href={href(item.path)}
              aria-current={isActive ? "page" : undefined}
              title={item.hint}
              onClick={() => navigate(item.path)}
            >
              <span className="bookmark-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.count ? <span className="bookmark-count">{item.count}</span> : null}
            </a>
          );
        })}
      </nav>

      <label className="sr-only" htmlFor="cokey-section-picker">
        Section
      </label>
      <select
        id="cokey-section-picker"
        className="bookmark-menu"
        value={active?.path ?? "/dashboard"}
        onChange={(event) => navigate(event.target.value)}
      >
        {items.map((item) => (
          <option key={item.path} value={item.path}>
            {item.label}
            {item.count ? ` (${item.count})` : ""}
          </option>
        ))}
      </select>
    </>
  );
}
