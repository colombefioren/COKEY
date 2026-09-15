import { useCallback, useEffect, useState } from "react";

export interface Route {
  path: string;

  section?: string;

  sub?: string;

  query: string;
}

export type Navigate = (path: string) => void;

function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "");
  const [clean = "", query = ""] = raw.split("?");
  const parts = clean.split("/").filter(Boolean);
  if (parts.length === 0) return { path: "/dashboard", query };
  return { path: `/${parts[0]}`, section: parts[1], sub: parts[2], query };
}

export function useRoute(): { route: Route; navigate: Navigate } {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);

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

export function href(path: string): string {
  return path.startsWith("#") ? path : `#${path}`;
}

export function queryParam(query: string, key: string): string | undefined {
  const params = new URLSearchParams(query);
  return params.get(key) ?? undefined;
}
