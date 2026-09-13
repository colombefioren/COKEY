import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import type { GuidanceSeverity } from "../types.js";
import { IconBell } from "./Icons.js";
import { Guidance } from "./Guidance.js";

/**
 * "Needs attention", as a notification bell rather than a fixture on the
 * Dashboard.
 *
 * It lives in the topbar so it is reachable from every screen — the whole
 * point of a notice like "every xKiro key is unusable" is that it should not
 * require being on the Dashboard to see. The badge is a plain count, not a
 * generic dot: the first thing anyone wants to know is how many, before they
 * open it to find out which.
 */
export function NotificationsBell({
  refreshKey,
  onChanged,
}: {
  refreshKey: number;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<Record<GuidanceSeverity, number> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.guidance();
        if (!cancelled) setSummary(data.summary);
      } catch {
        // Advisory only — the bell simply stays quiet until the next refresh.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, open]);

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

  const count = summary ? summary.critical + summary.warn : 0;

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        type="button"
        className={`notif-trigger${count > 0 ? " has-alerts" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={count > 0 ? `${count} notice(s) need attention` : "Notifications"}
        title="Needs attention"
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
        <div className="notif-panel" role="dialog" aria-label="Needs attention">
          <div className="notif-scroll">
            <Guidance refreshKey={refreshKey} onChanged={onChanged} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
