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
  } catch {}
}

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
