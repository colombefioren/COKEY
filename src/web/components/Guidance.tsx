import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, timeAgo } from "../api.js";
import type {
  GuidanceAction,
  GuidanceNotice,
  GuidanceResponse,
  GuidanceSeverity,
} from "../types.js";
import { Empty, Panel } from "./Primitives.js";
import { IconInfo } from "./Icons.js";
import { useToast } from "./Toast.js";
import { useSparkle } from "./Window.js";
import { useRoute } from "../router.js";

const DISMISS_KEY = "cokey.guidance.dismissed";

/** Chips read as words, not symbols: "needs a fix" beats a red triangle. */
const SEVERITY_LABEL: Record<GuidanceSeverity, string> = {
  critical: "needs a fix",
  warn: "worth a look",
  info: "notice",
};

const SEVERITY_TONE: Record<GuidanceSeverity, string> = {
  critical: "bad",
  warn: "warn",
  info: "neutral",
};

/**
 * What needs attention, and what to do about it.
 *
 * COKEY knows a lot it historically never said: which key keeps failing, which
 * chain node depends on a model a provider retired, which model list is three
 * weeks old. None of that fits in a count, and all of it has a specific, small
 * remedy — so each notice names the problem, explains the consequence, and
 * carries the buttons that fix it.
 *
 * The remedies run from here rather than sending the user to another screen to
 * find the right control. Re-verifying a key is one request; making someone
 * navigate to Keys, find the row, and press test would mean the notice is
 * cheaper to ignore than to act on.
 */
export function Guidance({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const toast = useToast();
  const { navigate } = useRoute();
  const { ref: panelRef, celebrate } = useSparkle<HTMLDivElement>("mint");

  const [data, setData] = useState<GuidanceResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed());

  const load = useCallback(async () => {
    try {
      setData(await api.guidance());
    } catch (error) {
      // Guidance is advisory. A failure to load it must never break the page it
      // is rendered on, so it degrades to silence rather than a toast storm.
      if (error instanceof ApiError && error.status >= 500) {
        toast.err(error.message);
      }
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const visible = useMemo(() => {
    const notices = data?.notices ?? [];
    return showDismissed ? notices : notices.filter((notice) => !dismissed.includes(notice.id));
  }, [data, dismissed, showDismissed]);

  const hiddenCount = (data?.notices.length ?? 0) - visible.length;

  function dismiss(id: string) {
    const next = [...new Set([...dismissed, id])];
    setDismissed(next);
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  }

  function restore() {
    setDismissed([]);
    window.localStorage.removeItem(DISMISS_KEY);
    setShowDismissed(false);
  }

  async function run(notice: GuidanceNotice, action: GuidanceAction) {
    if (action.kind === "navigate") {
      navigate(action.path);
      return;
    }

    setBusy(notice.id);
    try {
      if (action.kind === "reload-content") {
        const result = await api.reloadContent();
        if (result.changed) {
          toast.ok(`Content reloaded: ${result.counts.providers} providers`);
        } else if (result.issues.length > 0) {
          // Still broken after a re-read: say so once, with the first cause,
          // rather than reporting a success the user cannot see.
          toast.err(`${result.issues[0]!.file}: ${result.issues[0]!.message}`);
        } else {
          toast.info("Content reloaded: nothing changed");
        }
      } else if (action.kind === "refresh-models") {
        const report = await api.refreshProviderModels(action.providerId);
        if (!report.ok) {
          toast.err(report.message ?? `${report.displayName} could not be checked`);
        } else {
          const parts = [
            report.added.length ? `${report.added.length} new` : "",
            report.restored.length ? `${report.restored.length} restored` : "",
            report.removed.length ? `${report.removed.length} retired` : "",
          ].filter(Boolean);
          toast.ok(
            parts.length
              ? `${report.displayName}: ${parts.join(", ")} model(s)`
              : `${report.displayName} is unchanged (${report.discovered} models)`,
          );
        }
      } else {
        const result = await api.testCredential(action.credentialId);
        if (result.ok) {
          toast.ok("Key verified");
          // The one place a reward belongs: a remedy actually worked.
          celebrate();
        } else {
          toast.err(result.message ?? "Still failing");
        }
      }
      onChanged();
      await load();
    } catch (error) {
      toast.err(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function refreshAll() {
    setBusy("all");
    try {
      const result = await api.refreshAllProviderModels();
      const parts = [
        result.added ? `${result.added} new` : "",
        result.removed ? `${result.removed} retired` : "",
      ].filter(Boolean);
      toast.ok(
        `Checked ${result.refreshed} provider(s)${result.failed ? `, ${result.failed} unreachable` : ""}` +
          (parts.length ? ` — ${parts.join(", ")} model(s)` : ""),
      );
      onChanged();
      await load();
    } catch (error) {
      toast.err(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  const summary = data?.summary;

  return (
    <div ref={panelRef}>
      <Panel
        hue="butter"
        icon={<IconInfo size={14} />}
        title={`Needs attention${visible.length ? ` (${visible.length})` : ""}`}
        actions={
          <>
            {summary && (summary.critical > 0 || summary.warn > 0) ? (
              <span className="small faint">
                {summary.critical} to fix · {summary.warn} to watch
              </span>
            ) : null}
            {hiddenCount > 0 ? (
              <button className="ghost small" type="button" onClick={() => setShowDismissed(true)}>
                show {hiddenCount} dismissed
              </button>
            ) : null}
            {dismissed.length > 0 && !showDismissed ? (
              <button className="ghost small" type="button" onClick={restore}>
                reset dismissed
              </button>
            ) : null}
            <button
              className="secondary small"
              type="button"
              disabled={busy !== null}
              onClick={() => void refreshAll()}
            >
              {busy === "all" ? "checking…" : "re-check models"}
            </button>
          </>
        }
      >
        {data === null ? (
          <Empty>Checking the gateway…</Empty>
        ) : visible.length === 0 ? (
          <Empty> {hiddenCount > 0 ? `${hiddenCount} dismissed.` : "All clear."}</Empty>
        ) : (
          <div className="guidance-list">
            {visible.map((notice) => (
              <article key={notice.id} className={`guidance-item ${notice.severity}`}>
                <div className="guidance-head">
                  <span className={`badge ${SEVERITY_TONE[notice.severity]}`}>
                    {SEVERITY_LABEL[notice.severity]}
                  </span>
                  <strong className="guidance-title">{notice.title}</strong>
                </div>

                <p className="guidance-detail">{notice.detail}</p>

                <div className="guidance-actions">
                  {notice.actions.map((action, index) => (
                    <button
                      key={`${notice.id}-${action.kind}-${index}`}
                      className={index === 0 ? "" : "secondary"}
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void run(notice, action)}
                    >
                      {busy === notice.id && index === 0 ? "working…" : action.label}
                    </button>
                  ))}
                  <span className="spacer" />
                  <button
                    className="ghost small"
                    type="button"
                    onClick={() => dismiss(notice.id)}
                    title="Hide until it changes"
                  >
                    dismiss
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {data ? (
          <p className="faint small guidance-foot">
            checked {timeAgo(data.checkedAt)} · stays on this machine
          </p>
        ) : null}
      </Panel>
    </div>
  );
}

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
