import type { Nudge } from "../types.js";
import { useLang } from "../lang.js";

export function Nudger({
  nudge,
  onDismiss,
  onGoToProviders,
}: {
  nudge: Nudge;
  onDismiss: () => void;
  onGoToProviders: () => void;
}) {
  const { t } = useLang();
  if (!nudge.enabled) return null;
  if (nudge.connectedFree >= nudge.target) return null;

  const missing = nudge.target - nudge.connectedFree;
  const suggestions = nudge.suggestions.slice(0, 3);

  return (
    <div className="nudger">
      <h3>
        {nudge.connectedFree} {t("of")} {nudge.target} {t("free providers connected")}
      </h3>
      <div className="muted">
        {t("Add")} {missing} {t("more and a rate limit can never block you.")}
      </div>

      <div className="actions">
        {suggestions.map((suggestion) => (
          <a key={suggestion.id} href={suggestion.signupUrl} target="_blank" rel="noreferrer">
            <button className="secondary">
              {t("Connect")} {suggestion.displayName} ↗
            </button>
          </a>
        ))}
        <button className="secondary" onClick={onGoToProviders}>
          {t("Browse providers")}
        </button>
        <button className="ghost" onClick={onDismiss}>
          {t("Later")}
        </button>
      </div>
    </div>
  );
}
