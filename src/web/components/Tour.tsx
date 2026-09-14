import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { TOUR_STEPS } from "../tour-steps.js";
import { useLang } from "../lang.js";

/** Persisted once the tour is skipped or finished, so it never auto-opens again. */
export const TOUR_SEEN_KEY = "cokey.tour.seen";

interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Loose margin around the real element, so the spotlight has room to breathe. */
const SPOT_PADDING = 8;
/** A route change re-renders the new page synchronously, but give it one frame
 * before measuring so layout has actually settled. */
const ROUTE_SETTLE_MS = 50;

function measureTarget(target: string | undefined): SpotRect | null {
  if (!target) return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
  const box = el.getBoundingClientRect();
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

/**
 * The onboarding tour: a real walk through every page, not a tooltip parade
 * over the sidebar. A step whose data names a `route` navigates there first -
 * the tour is the one place in the app that drives the router on the user's
 * behalf - and only measures its spotlight once that page has actually
 * mounted, so the highlight is never drawn against the page that used to be
 * there. Steps with no target (the welcome and closing cards) render as a
 * plain centred card over whatever page is already open.
 */
export function Tour({
  open,
  onClose,
  currentPath,
  navigate,
  onRequestNavOpen,
}: {
  open: boolean;
  onClose: () => void;
  /** The router's current path, so a step can tell whether it still needs to navigate. */
  currentPath: string;
  navigate: (path: string) => void;
  onRequestNavOpen: (open: boolean) => void;
}) {
  const { t } = useLang();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<SpotRect | null>(null);
  const step = TOUR_STEPS[stepIndex];

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  // A mobile drawer left open from before the tour started would otherwise
  // float over every page the tour visits; none of the tour's own targets
  // live inside it, so it only ever needs to be closed, never opened.
  useEffect(() => {
    if (open) onRequestNavOpen(false);
  }, [open, onRequestNavOpen]);

  useEffect(() => {
    if (!open || !step) return;

    if (step.route && currentPath !== step.route) {
      navigate(step.route);
      return;
    }

    const measure = () => setRect(measureTarget(step.target));
    const timer = window.setTimeout(measure, ROUTE_SETTLE_MS);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, [open, step, currentPath, navigate]);

  const finish = useCallback(() => {
    window.localStorage.setItem(TOUR_SEEN_KEY, "1");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, finish]);

  if (!open || !step) return null;

  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const isFirst = stepIndex === 0;
  const onRightRoute = !step.route || step.route === currentPath;
  const spot =
    rect && onRightRoute
      ? {
          top: rect.top - SPOT_PADDING,
          left: rect.left - SPOT_PADDING,
          width: rect.width + SPOT_PADDING * 2,
          height: rect.height + SPOT_PADDING * 2,
        }
      : null;

  return (
    <div className="tour-scrim" role="dialog" aria-modal="true" aria-label={t("Guided tour")}>
      {spot ? (
        <div
          className="tour-spot"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      ) : null}

      <TourCard
        step={{ title: t(step.title), body: t(step.body) }}
        spot={spot}
        placement={spot ? step.placement : "center"}
        stepNumber={stepIndex + 1}
        stepCount={TOUR_STEPS.length}
        isFirst={isFirst}
        isLast={isLast}
        onBack={() => setStepIndex((i) => Math.max(0, i - 1))}
        onNext={() => (isLast ? finish() : setStepIndex((i) => i + 1))}
        onSkip={finish}
      />
    </div>
  );
}

function TourCard({
  step,
  spot,
  placement,
  stepNumber,
  stepCount,
  isFirst,
  isLast,
  onBack,
  onNext,
  onSkip,
}: {
  step: { title: string; body: string };
  spot: SpotRect | null;
  placement: "right" | "bottom" | "left" | "top" | "center";
  stepNumber: number;
  stepCount: number;
  isFirst: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { t } = useLang();
  const cardStyle = cardPosition(spot, placement);

  return (
    <div className={`tour-card tour-card-${placement}`} style={cardStyle}>
      {placement === "right" ? <TourArrowLeft /> : null}
      {placement === "bottom" ? <TourArrowUp /> : null}

      <div className="tour-eyebrow">
        {stepNumber} {t("of")} {stepCount}
      </div>
      <h3 className="tour-title">{step.title}</h3>
      <p className="tour-body">{step.body}</p>

      <div className="tour-actions">
        <button type="button" className="ghost" onClick={onSkip}>
          {t("Skip")}
        </button>
        <span className="spacer" />
        {!isFirst ? (
          <button type="button" className="secondary" onClick={onBack}>
            {t("Back")}
          </button>
        ) : null}
        <button type="button" onClick={onNext}>
          {isLast ? t("Done") : t("Next")}
        </button>
      </div>
    </div>
  );
}

/** Fixed-position pixel coordinates for the card, clamped to stay on screen. */
function cardPosition(
  spot: SpotRect | null,
  placement: "right" | "bottom" | "left" | "top" | "center",
): CSSProperties {
  const margin = 16;
  const cardWidth = 300;

  if (!spot || placement === "center") {
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  if (placement === "right") {
    const top = Math.min(
      Math.max(spot.top, margin),
      window.innerHeight - margin - 40, // leaves room for a short card near the bottom
    );
    return { top, left: Math.min(spot.left + spot.width + 22, window.innerWidth - cardWidth - margin) };
  }

  // bottom
  const left = Math.min(
    Math.max(spot.left + spot.width / 2 - cardWidth / 2, margin),
    window.innerWidth - cardWidth - margin,
  );
  return { top: Math.min(spot.top + spot.height + 22, window.innerHeight - 200), left };
}

function TourArrowLeft() {
  return (
    <svg
      className="tour-arrow tour-arrow-left"
      width="48"
      height="30"
      viewBox="0 0 48 30"
      aria-hidden="true"
    >
      <path
        d="M44 22 Q26 6 10 15 L20 8 M10 15 L19 22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TourArrowUp() {
  return (
    <svg
      className="tour-arrow tour-arrow-up"
      width="30"
      height="48"
      viewBox="0 0 30 48"
      aria-hidden="true"
    >
      <path
        d="M22 44 Q6 26 15 10 L8 20 M15 10 L22 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
