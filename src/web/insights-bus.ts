/**
 * A tiny, dependency-free signal bus for the Insights cards.
 *
 * `api.ts` calls into this whenever a credential test or a model probe comes
 * back, and `<Insights>` is the only subscriber. Keeping the bus itself free
 * of React means the API layer can report a signal without importing a
 * component, and a test can drive it without mounting anything.
 */

export type InsightSignal =
  /** One test or probe came back with this failure classification. */
  | { kind: "failure"; classification: string }
  /** Several tests or probes fired in a short window - a possible quota risk. */
  | { kind: "bulk"; area: "credential" | "model" };

type Listener = (signal: InsightSignal) => void;

const listeners = new Set<Listener>();

export function subscribeInsights(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(signal: InsightSignal): void {
  for (const listener of listeners) listener(signal);
}

/** A test or probe failed. Reported regardless of how the caller surfaces it. */
export function reportInsightFailure(classification: string | undefined): void {
  if (!classification) return;
  emit({ kind: "failure", classification });
}

/** How many test/probe calls in a row count as "back-to-back". */
const BULK_THRESHOLD = 5;
/** The window those calls have to fall inside to count as one burst. */
const BULK_WINDOW_MS = 45_000;
/** Do not re-warn about the same burst for a while. */
const BULK_COOLDOWN_MS = 5 * 60_000;

const attemptsByArea: Record<"credential" | "model", number[]> = {
  credential: [],
  model: [],
};
const bulkFiredAt: Record<"credential" | "model", number> = {
  credential: 0,
  model: 0,
};

/** Call on every test/probe attempt, success or failure, to track volume. */
export function reportInsightAttempt(area: "credential" | "model"): void {
  const now = Date.now();
  const attempts = attemptsByArea[area].filter((at) => now - at < BULK_WINDOW_MS);
  attempts.push(now);
  attemptsByArea[area] = attempts;

  if (attempts.length >= BULK_THRESHOLD && now - bulkFiredAt[area] > BULK_COOLDOWN_MS) {
    bulkFiredAt[area] = now;
    emit({ kind: "bulk", area });
  }
}

/** Test-only: drop tracked attempts and cooldowns between cases. */
export function resetInsightTracking(): void {
  attemptsByArea.credential = [];
  attemptsByArea.model = [];
  bulkFiredAt.credential = 0;
  bulkFiredAt.model = 0;
}
