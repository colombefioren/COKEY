import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { subscribeInsights, type InsightSignal } from "../insights-bus.js";
import { useLang } from "../lang.js";

interface Card {
  id: number;
  kind: "tip" | "fact";
  text: string;
}

/** How long a card stays up before it dismisses itself. Tips get longer than a toast; there is more to read. */
const CARD_MS = 10_000;
/** Do not repeat the same reactive tip within this window. */
const TIP_COOLDOWN_MS = 30_000;
/** Wait this long after mount before the first fun fact can appear. */
const FIRST_FACT_DELAY_MS = 40_000;
/** Then space fun facts out randomly between these two bounds. */
const FACT_INTERVAL_MIN_MS = 4 * 60_000;
const FACT_INTERVAL_MAX_MS = 8 * 60_000;

const FALLBACK_FACTS = [
  "Did you know COKEY never fabricates a quota? A provider that publishes no rate-limit header is reported as Quota: Unknown, not a guess.",
  "COKEY's routing invariant fits in five words: node, then key, then node.",
  "Two keys of the same provider never share an exit IP once the automatic egress pool is on - that's the whole point of it.",
];

function tipTextFor(classification: string, t: (s: string) => string): string | null {
  switch (classification) {
    case "credential_invalid":
      return t(
        "That key came back invalid. Worth a double-check for a stray trailing space or newline from a copy-paste - a surprising number of \"invalid key\" errors are exactly that.",
      );
    case "credential_rate_limited":
      return t(
        "Rate-limited already? If this key shares an exit IP with others on the same provider, an egress pool gives each one its own IP - Settings → Automatic egress pool.",
      );
    case "quota_exhausted":
      return t(
        "Quota's gone for this key. If you were testing several keys back-to-back, some providers count verification calls against the same daily quota as real traffic.",
      );
    case "network_error":
      return t(
        "Couldn't reach the provider at all. If you're behind a VPN or a proxy, that's usually the first thing to check.",
      );
    case "temporary_provider_error":
      return t(
        "The provider hiccuped (5xx) - that's usually about them, not your key. Worth a retry in a moment.",
      );
    case "model_unavailable":
      return t(
        "That model isn't reachable through this key right now. Some providers gate free models per account rather than per key.",
      );
    case "context_too_large":
      return t(
        "That request was too big for the model's context window - rotating keys won't help here, only a shorter prompt will.",
      );
    case "invalid_request":
      return t(
        "The provider rejected the request shape itself, not the key - check the model name matches what the provider actually serves.",
      );
    default:
      return null;
  }
}

function bulkTextFor(area: "credential" | "model", t: (s: string) => string): string {
  return area === "credential"
    ? t(
        "Testing a lot of keys back-to-back? A few providers count verification calls against the same quota as real traffic - worth pacing it out if you'll need them soon.",
      )
    : t(
        "Checking every model in a row can eat into a provider's daily quota faster than real usage would. Consider testing just the ones you're about to chain.",
      );
}

/**
 * Bottom-right contextual flash cards.
 *
 * Two kinds of card share one small queue: a reactive tip the moment a
 * credential test or model probe fails in a way that has a known, likely
 * cause, and an occasional fun fact so the corner is not only ever bad news.
 * Facts come from the same on-demand ranking bundle as the Rankings screen
 * (`/api/catalog/rankings`), so a published update can refresh them without a
 * release, exactly like the ranking boards themselves.
 *
 * Only one card is ever on screen. It self-dismisses; a click dismisses it
 * immediately. The container sits above the toast stack so the two never
 * overlap when both have something to say at once.
 */
export function Insights() {
  const { t } = useLang();
  const [card, setCard] = useState<Card | null>(null);
  const queue = useRef<Card[]>([]);
  const nextId = useRef(0);
  const lastTipAt = useRef<Map<string, number>>(new Map());
  const facts = useRef<string[]>(FALLBACK_FACTS);
  const dismissTimer = useRef<number | undefined>(undefined);

  // Set synchronously inside `advance` itself, not via an effect on `card`:
  // two signals emitted back-to-back in the same tick (a bulk warning and a
  // failure from the same probe, say) must not both see "nothing showing" and
  // both call `advance`, which would silently drop whichever card lost the
  // race for `queue.current.shift()`.
  const active = useRef(false);

  const advance = useCallback(() => {
    window.clearTimeout(dismissTimer.current);
    const next = queue.current.shift() ?? null;
    active.current = next !== null;
    setCard(next);
    if (next) {
      dismissTimer.current = window.setTimeout(advance, CARD_MS);
    }
  }, []);

  const enqueue = useCallback(
    (next: Omit<Card, "id">) => {
      const item: Card = { ...next, id: nextId.current++ };
      queue.current.push(item);
      if (!active.current) advance();
    },
    [advance],
  );

  const dismiss = useCallback(() => {
    advance();
  }, [advance]);

  // Fun facts come from the same bundle Rankings can refresh. A failed fetch
  // just leaves the small bundled fallback list in place.
  useEffect(() => {
    let cancelled = false;
    void api
      .rankings()
      .then((rankings) => {
        if (!cancelled && rankings.funFacts && rankings.funFacts.length > 0) {
          facts.current = rankings.funFacts;
        }
      })
      .catch(() => {
        // Keep the fallback list.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handle = (signal: InsightSignal) => {
      if (signal.kind === "failure") {
        const last = lastTipAt.current.get(signal.classification) ?? 0;
        if (Date.now() - last < TIP_COOLDOWN_MS) return;
        const text = tipTextFor(signal.classification, t);
        if (!text) return;
        lastTipAt.current.set(signal.classification, Date.now());
        enqueue({ kind: "tip", text });
        return;
      }
      enqueue({ kind: "tip", text: bulkTextFor(signal.area, t) });
    };
    return subscribeInsights(handle);
  }, [enqueue, t]);

  useEffect(() => {
    let timer: number;
    const showFact = () => {
      const list = facts.current;
      if (list.length > 0) {
        const text = list[Math.floor(Math.random() * list.length)]!;
        enqueue({ kind: "fact", text });
      }
      const delay =
        FACT_INTERVAL_MIN_MS + Math.random() * (FACT_INTERVAL_MAX_MS - FACT_INTERVAL_MIN_MS);
      timer = window.setTimeout(showFact, delay);
    };
    timer = window.setTimeout(showFact, FIRST_FACT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enqueue]);

  useEffect(() => () => window.clearTimeout(dismissTimer.current), []);

  if (!card) return null;

  return (
    <div className="insights" aria-live="polite">
      <div key={card.id} className={`insight-card ${card.kind}`}>
        <span className="insight-glyph" aria-hidden="true">
          {card.kind === "fact" ? "✨" : "💡"}
        </span>
        <span className="insight-text">{card.text}</span>
        <button
          type="button"
          className="insight-close"
          onClick={dismiss}
          aria-label={t("Dismiss")}
          title={t("Dismiss")}
        >
          ×
        </button>
      </div>
    </div>
  );
}
