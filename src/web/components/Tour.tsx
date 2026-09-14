import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { TOUR_STEPS } from "../tour-steps.js";
import { MOBILE_QUERY } from "./Sidebar.js";
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
/** How long the sidebar drawer's own slide takes, in responsive.css. */
const DRAWER_TRANSITION_MS = 320;

function measureTarget(target: string | undefined): SpotRect | null {
  if (!target) return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

/**
 * The onboarding tour: a dark scrim with one rectangular window cut into it
 * around the current step's target, a callout card, and a hand-drawn arrow
 * joining the two.
 *
 * Every step but the first and last targets a real, always-mounted piece of
 * chrome via a `data-tour` attribute, found fresh on every step change and on
 * resize - there is no cached layout to go stale. A step whose target lives in
 * the sidebar briefly opens the mobile drawer if it is currently a hidden
 * off-canvas panel, and waits out its slide transition before measuring, so
 * the spotlight is never drawn over a rail that has not finished sliding in.
 */
export function Tour({
  open,
  onClose,
  onRequestNavOpen,
}: {
  open: boolean;
  onClose: () => void;
  onRequestNavOpen: (open: boolean) => void;
}) {
  const { t } = useLang();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<SpotRect | null>(null);
  const step = TOUR_STEPS[stepIndex];

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    const needsDrawer = isMobile && !!step?.target?.startsWith("nav-");
    if (isMobile) onRequestNavOpen(needsDrawer);

    const measure = () => setRect(measureTarget(step?.target));
    const timer = window.setTimeout(measure, needsDrawer ? DRAWER_TRANSITION_MS : 20);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, [open, step, onRequestNavOpen]);

  useEffect(() => {
    if (!open) return;
    return () => onRequestNavOpen(false);
  }, [open, onRequestNavOpen]);

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
  const spot = rect
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
    <svg className="tour-arrow tour-arrow-left" width="46" height="34" viewBox="0 0 46 34" aria-hidden="true">
      <path
        d="M43 27C33 30 12 29 5 15C2 9 4 5 8 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M3 10 5 3 12 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TourArrowUp() {
  return (
    <svg className="tour-arrow tour-arrow-up" width="34" height="46" viewBox="0 0 34 46" aria-hidden="true">
      <path
        d="M27 43C30 33 29 12 15 5C9 2 5 4 3 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M10 3 3 5 6 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
