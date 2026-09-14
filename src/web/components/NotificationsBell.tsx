import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "../lang.js";
import { api, ApiError } from "../api.js";
import type { GuidanceResponse } from "../types.js";
import { IconBell } from "./Icons.js";
import { Guidance } from "./Guidance.js";
import { useToast } from "./Toast.js";

const DISMISS_KEY = "cokey.guidance.dismissed";

function readDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]): void {
  try {
    if (ids.length === 0) window.localStorage.removeItem(DISMISS_KEY);
    else window.localStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
  } catch {
    // Private browsing or a blocked store: dismissals just don't persist.
  }
}

/**
 * "Needs attention", as a notification bell rather than a fixture on the
 * Dashboard.
 *
 * It lives in the topbar so it is reachable from every screen — the whole
 * point of a notice like "every xKiro key is unusable" is that it should not
 * require being on the Dashboard to see. The badge is a plain count, not a
 * generic dot: the first thing anyone wants to know is how many, before they
 * open it to find out which.
 *
 * The dismissed set lives here, one level above the dropdown, rather than
 * inside it — the badge needs to know the same thing the dropdown does
 * ("dismissed notices don't count"), and two components independently
 * reading the same localStorage key is exactly how the badge and the panel
 * drift apart the moment one of them updates without the other noticing.
 */
export function NotificationsBell({
  refreshKey,
  onChanged,
}: {
  refreshKey: number;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<GuidanceResponse | null>(null);
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed());
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.guidance());
    } catch (error) {
      // Guidance is advisory. A failure to load it must never break the page it
      // is rendered on, so it degrades to silence rather than a toast storm.
      if (error instanceof ApiError && error.status >= 500) toast.err(error.message);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const dismiss = useCallback((id: string) => {
    setDismissed((current) => {
      const next = current.includes(id) ? current : [...current, id];
      writeDismissed(next);
      return next;
    });
  }, []);

  const dismissMany = useCallback((ids: string[]) => {
    setDismissed((current) => {
      const next = [...new Set([...current, ...ids])];
      writeDismissed(next);
      return next;
    });
  }, []);

  const restore = useCallback(() => {
    setDismissed([]);
    writeDismissed([]);
  }, []);

  const visibleNotices = (data?.notices ?? []).filter((notice) => !dismissed.includes(notice.id));
  const count = visibleNotices.filter(
    (notice) => notice.severity === "critical" || notice.severity === "warn",
  ).length;

  return (
    <div className="notif-bell" ref={rootRef} data-tour="notif-bell">
      <button
        type="button"
        className={`notif-trigger${count > 0 ? " has-alerts" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={count > 0 ? `${count} ${t("notice(s) need attention")}` : t("Notifications")}
        title={t("Needs attention")}
      >
        <IconBell size={18} />
        {count > 0 ? <span className="notif-count">{count > 9 ? "9+" : count}</span> : null}
      </button>

      {/*
       * Two layers on purpose. The tray holds the scroll boundary and the
       * padding; the inner column is what actually moves. Scrolling the panel
       * itself was what sliced the notice cards' inked outlines off against
       * the dropdown edge — the tray gives them room to be scrolled past
       * instead of through.
       */}
      {open ? (
        <div className="notif-panel" role="dialog" aria-label={t("Needs attention")}>
          <div className="notif-scroll">
            <Guidance
              data={data}
              dismissed={dismissed}
              onDismiss={dismiss}
              onDismissMany={dismissMany}
              onRestore={restore}
              onReload={load}
              onChanged={onChanged}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
