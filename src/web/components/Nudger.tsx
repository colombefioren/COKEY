import type { Nudge } from "../types.js";

/**
 * The free-provider nudger.
 *
 * Purely local: it counts connected advertised-free providers and suggests more
 * so a single rate limit cannot block the user. It never claims a provider is
 * free unless that provider advertises it.
 */
export function Nudger({
  nudge,
  onDismiss,
  onGoToProviders,
}: {
  nudge: Nudge;
  onDismiss: () => void;
  onGoToProviders: () => void;
}) {
  if (!nudge.enabled) return null;
  if (nudge.connectedFree >= nudge.target) return null;

  const missing = nudge.target - nudge.connectedFree;
  const suggestions = nudge.suggestions.slice(0, 3);

  return (
    <div className="nudger">
      <h3>
        You have {nudge.connectedFree} of {nudge.target} free providers connected.
      </h3>
      <div className="muted">
        Adding {missing} more {missing === 1 ? "provider" : "providers"} unlocks automatic failover,
        so a single rate limit never blocks you.
      </div>

      <div className="actions">
        {suggestions.map((suggestion) => (
          <a key={suggestion.id} href={suggestion.signupUrl} target="_blank" rel="noreferrer">
            <button className="secondary">Connect {suggestion.displayName} ↗</button>
          </a>
        ))}
        <button className="secondary" onClick={onGoToProviders}>
          Browse providers
        </button>
        <button className="ghost" onClick={onDismiss}>
          Remind me later
        </button>
      </div>
    </div>
  );
}
