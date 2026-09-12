import { useCallback, useEffect, useState } from "react";

/**
 * A minimal hash router.
 *
 * Deliberately dependency-free: the dashboard is served by the gateway as a
 * single HTML file, so a hash route needs no server cooperation and survives a
 * hard refresh. `useRoute` is the only hook the pages need.
 */

export interface Route {
  /** Path without the leading hash, for example `/chains`. */
  path: string;
  /** Optional tab within the page, for example `#/models/rankings`. */
  section?: string;
  /** Optional deeper segment, for example the board in `#/models/rankings/rate`. */
  sub?: string;
}

export type Navigate = (path: string) => void;

function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "");
  const clean = raw.split("?")[0] ?? "";
  const parts = clean.split("/").filter(Boolean);
  if (parts.length === 0) return { path: "/dashboard" };
  return { path: `/${parts[0]}`, section: parts[1], sub: parts[2] };
}

export function useRoute(): { route: Route; navigate: Navigate } {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    // Normalise a bare URL so the sidebar always has an active item.
    if (!window.location.hash) window.location.hash = "#/dashboard";
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback<Navigate>((path) => {
    const next = path.startsWith("#") ? path : `#${path}`;
    if (window.location.hash === next) return;
    window.location.hash = next;
  }, []);

  return { route, navigate };
}

/** Build a href for an anchor so links stay copyable and middle-clickable. */
export function href(path: string): string {
  return path.startsWith("#") ? path : `#${path}`;
}
