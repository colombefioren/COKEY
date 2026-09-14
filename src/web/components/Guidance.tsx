import { useMemo, useState } from "react";
import { api, timeAgo } from "../api.js";
import type { GuidanceAction, GuidanceNotice, GuidanceResponse, GuidanceSeverity } from "../types.js";
import { Empty, Panel } from "./Primitives.js";
import { IconInfo } from "./Icons.js";
import { useToast } from "./Toast.js";
import { useSparkle } from "./Window.js";
import { useRoute } from "../router.js";
import { useLang } from "../lang.js";

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
 *
 * The data and the dismissed set are both owned by the notification bell, one
 * level up — this component only renders them and reports intent (dismiss
 * this, dismiss all, restore, reload) back to whoever holds the state, so the
 * bell's badge and this panel can never disagree about what is still visible.
 */
export function Guidance({
  data,
  dismissed,
  onDismiss,
  onDismissMany,
  onRestore,
  onReload,
  onChanged,
}: {
  data: GuidanceResponse | null;
  dismissed: string[];
  onDismiss: (id: string) => void;
  onDismissMany: (ids: string[]) => void;
  onRestore: () => void;
  onReload: () => Promise<void>;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { t } = useLang();
  const { navigate } = useRoute();
  const { ref: panelRef, celebrate } = useSparkle<HTMLDivElement>("mint");

  const [busy, setBusy] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  const visible = useMemo(() => {
    const notices = data?.notices ?? [];
    return showDismissed ? notices : notices.filter((notice) => !dismissed.includes(notice.id));
  }, [data, dismissed, showDismissed]);

  const hiddenCount = (data?.notices.length ?? 0) - visible.length;

  function restore() {
    onRestore();
    setShowDismissed(false);
  }

  async function run(notice: GuidanceNotice, action: GuidanceAction) {
    if (action.kind === "navigate") {
      navigate(action.path);
      return;
    }

    setBusy(notice.id);
    try {
      if (action.kind === "refresh-models") {
        const report = await api.refreshProviderModels(action.providerId);
        if (!report.ok) {
          toast.err(report.message ?? `${report.displayName} ${t("could not be checked")}`);
        } else {
          const parts = [
            report.added.length ? `${report.added.length} ${t("new")}` : "",
            report.restored.length ? `${report.restored.length} ${t("restored")}` : "",
            report.removed.length ? `${report.removed.length} ${t("retired")}` : "",
          ].filter(Boolean);
          toast.ok(
            parts.length
              ? `${report.displayName}: ${parts.join(", ")} ${t("model(s)")}`
              : `${report.displayName} ${t("is unchanged")} (${report.discovered} ${t("models")})`,
          );
        }
      } else {
        const result = await api.testCredential(action.credentialId);
        if (result.ok) {
          toast.ok(t("Key verified"));
          // The one place a reward belongs: a remedy actually worked.
          celebrate();
        } else {
          toast.err(result.message ?? t("Still failing"));
        }
      }
      onChanged();
      await onReload();
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
        result.added ? `${result.added} ${t("new")}` : "",
        result.removed ? `${result.removed} ${t("retired")}` : "",
      ].filter(Boolean);
      toast.ok(
        `${t("Checked")} ${result.refreshed} ${t("provider(s)")}${result.failed ? `, ${result.failed} ${t("unreachable")}` : ""}` +
          (parts.length ? ` — ${parts.join(", ")} ${t("model(s)")}` : ""),
      );
      onChanged();
      await onReload();
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
        title={`${t("Needs attention")}${visible.length ? ` (${visible.length})` : ""}`}
        actions={
          <>
            {summary && (summary.critical > 0 || summary.warn > 0) ? (
              <span className="small faint">
                {summary.critical} {t("to fix")} · {summary.warn} {t("to watch")}
              </span>
            ) : null}
            {hiddenCount > 0 ? (
              <button className="ghost small" type="button" onClick={() => setShowDismissed(true)}>
                {t("show")} {hiddenCount} {t("dismissed")}
              </button>
            ) : null}
            {dismissed.length > 0 && !showDismissed ? (
              <button className="ghost small" type="button" onClick={restore}>
                {t("reset dismissed")}
              </button>
            ) : null}
            {visible.length > 0 && !showDismissed ? (
              <button
                className="ghost small"
                type="button"
                onClick={() => onDismissMany(visible.map((notice) => notice.id))}
              >
                {t("dismiss all")}
              </button>
            ) : null}
            <button
              className="secondary small"
              type="button"
              disabled={busy !== null}
              onClick={() => void refreshAll()}
            >
              {busy === "all" ? t("checking…") : t("re-check models")}
            </button>
          </>
        }
      >
        {data === null ? (
          <Empty>{t("Checking the gateway…")}</Empty>
        ) : visible.length === 0 ? (
          <Empty> {hiddenCount > 0 ? `${hiddenCount} ${t("dismissed.")}` : t("All clear.")}</Empty>
        ) : (
          <div className="guidance-list">
            {visible.map((notice) => (
              <article key={notice.id} className={`guidance-item ${notice.severity}`}>
                <div className="guidance-head">
                  <span className={`badge ${SEVERITY_TONE[notice.severity]}`}>
                    {t(SEVERITY_LABEL[notice.severity])}
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
                      {busy === notice.id && index === 0 ? t("working…") : action.label}
                    </button>
                  ))}
                  <span className="spacer" />
                  <button
                    className="ghost small"
                    type="button"
                    onClick={() => onDismiss(notice.id)}
                    title={t("Hide until it changes")}
                  >
                    {t("dismiss")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {data ? (
          <p className="faint small guidance-foot">
            {t("checked")} {timeAgo(data.checkedAt)} · {t("stays on this machine")}
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
