export type InsightSignal =
  { kind: "failure"; classification: string } | { kind: "bulk"; area: "credential" | "model" };

type Listener = (signal: InsightSignal) => void;

const listeners = new Set<Listener>();

export function subscribeInsights(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(signal: InsightSignal): void {
  for (const listener of listeners) listener(signal);
}

export function reportInsightFailure(classification: string | undefined): void {
  if (!classification) return;
  emit({ kind: "failure", classification });
}

const BULK_THRESHOLD = 5;

const BULK_WINDOW_MS = 45_000;

const BULK_COOLDOWN_MS = 5 * 60_000;

const attemptsByArea: Record<"credential" | "model", number[]> = {
  credential: [],
  model: [],
};
const bulkFiredAt: Record<"credential" | "model", number> = {
  credential: 0,
  model: 0,
};

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

export function resetInsightTracking(): void {
  attemptsByArea.credential = [];
  attemptsByArea.model = [];
  bulkFiredAt.credential = 0;
  bulkFiredAt.model = 0;
}
