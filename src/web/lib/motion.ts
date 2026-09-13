/*
 * Motion helpers.
 *
 * A deliberate split of responsibility:
 *
 *   CSS    declares the states a control can be in — the hard offset shadow,
 *          the pressed position, the window-pop keyframe. These must work
 *          before a single byte of JavaScript has run, and they must survive a
 *          re-render without a library holding a reference to the node.
 *
 *   GSAP   orchestrates the few moments that are genuinely a sequence: a route
 *          being walked node by node, a board re-ranking itself, a burst of
 *          stars when something succeeds. None of it belongs in a stylesheet
 *          because the timing depends on data.
 *
 * `gsap/registerEffect` is not used on purpose: these are plain functions, so
 * there is no global plugin state to keep in sync and nothing to unregister.
 */

import gsap from "gsap";

/** True when the user has asked the OS for reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Guard every helper: a test renderer and a headless render have no layout. */
function canAnimate(target: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (prefersReducedMotion()) return false;
  return Boolean(target);
}

/**
 * Walk a chain diagram from left to right.
 *
 * Called when a request begins routing. Each node lifts a few pixels in turn,
 * which communicates *order*: the diagram is telling you which entry was
 * reached, not merely that something is happening. The returned function kills
 * the tween so a fast successive request cannot leave two walks overlapping.
 */
export function animateRouteWalk(nodes: HTMLElement[]): () => void {
  if (!canAnimate(nodes.length)) return () => undefined;

  const tween = gsap.fromTo(
    nodes,
    { y: 0, boxShadow: "2px 2px 0 var(--line)" },
    {
      y: -6,
      duration: 0.28,
      ease: "power2.out",
      stagger: 0.14,
      repeat: 1,
      yoyo: true,
      // The shadow rides along so the lift reads as physical.
      onStart: () => {
        for (const node of nodes) node.style.zIndex = "2";
      },
      onComplete: () => {
        for (const node of nodes) node.style.zIndex = "";
      },
    },
  );

  return () => tween.kill();
}

/**
 * Choreograph a board that has just re-ranked.
 *
 * Ranking boards change underneath the reader whenever a provider adds or drops
 * a model. Rather than the row teleporting, rows settle into their new order
 * with a short stagger, so the change is legible as a change.
 */
export function animateRankedRows(rows: HTMLElement[]): () => void {
  if (!canAnimate(rows.length)) return () => undefined;

  const tween = gsap.fromTo(
    rows,
    { opacity: 0.35, x: -8 },
    {
      opacity: 1,
      x: 0,
      duration: 0.34,
      ease: "power2.out",
      stagger: 0.035,
      overwrite: true,
    },
  );

  return () => tween.kill();
}

/**
 * A small burst of stars, tied to the theme rather than a generic confetti.
 *
 * Anchored to the element that succeeded: the check that just turned green, the
 * key that just verified. Cleanup is guaranteed by the tween's own onComplete,
 * and the particles are `position: absolute` blocks with no blur, matching the
 * rest of the surface language.
 */
export function burstSparkles(
  anchor: HTMLElement,
  options: { count?: number; hue?: "butter" | "pink" | "mint" } = {},
): void {
  if (!canAnimate(anchor)) return;

  const count = options.count ?? 9;
  const host = anchor.closest<HTMLElement>(".window, section.panel, .card, .modal") ?? anchor;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";

  const field = document.createElement("div");
  field.className = "sparkle-field";
  if (options.hue) {
    field.style.setProperty("--spark-color", `var(--hue-${options.hue})`);
  }
  host.appendChild(field);

  const anchorBox = anchor.getBoundingClientRect();
  const hostBox = host.getBoundingClientRect();
  const originX = anchorBox.left - hostBox.left + anchorBox.width / 2;
  const originY = anchorBox.top - hostBox.top + anchorBox.height / 2;

  const bits: HTMLElement[] = [];
  for (let index = 0; index < count; index += 1) {
    const bit = document.createElement("span");
    bit.className = "sparkle-bit";
    // Alternate sizes so the burst does not look stamped.
    const size = index % 3 === 0 ? 9 : 6;
    bit.style.width = `${size}px`;
    bit.style.height = `${size}px`;
    bit.style.left = `${originX}px`;
    bit.style.top = `${originY}px`;
    field.appendChild(bit);
    bits.push(bit);
  }

  gsap.to(bits, {
    // A full circle of directions, biased upward so it reads as a burst.
    x: () => gsap.utils.random(-42, 42),
    y: () => gsap.utils.random(-52, 18),
    rotate: () => gsap.utils.random(-180, 180),
    scale: () => gsap.utils.random(0.4, 1.1),
    opacity: 0,
    duration: 0.72,
    ease: "power2.out",
    stagger: 0.016,
    onComplete: () => field.remove(),
  });
}

/**
 * Count a number up to its new value.
 *
 * Used only where the number is the point — a total, a success rate — and only
 * when the value actually changed, so a poll that returns the same figure does
 * not re-animate and waste the reader's attention.
 */
export function countUp(
  element: HTMLElement,
  to: number,
  options: { duration?: number; format?: (value: number) => string } = {},
): void {
  const format = options.format ?? ((value: number) => Math.round(value).toLocaleString());
  const from = Number(element.dataset.value ?? "0");

  element.dataset.value = String(to);
  if (!canAnimate(element) || from === to) {
    element.textContent = format(to);
    return;
  }

  const state = { value: from };
  gsap.to(state, {
    value: to,
    duration: options.duration ?? 0.5,
    ease: "power1.out",
    onUpdate: () => {
      element.textContent = format(state.value);
    },
    onComplete: () => {
      element.textContent = format(to);
    },
  });
}

/**
 * Press feedback for an element that is not a `<button>`.
 *
 * Chain nodes and model chips are clickable divs, so they do not inherit the
 * browser's `:active` handling. This gives them the same physical push the CSS
 * gives a real button.
 */
export function pressFeedback(element: HTMLElement): void {
  if (!canAnimate(element)) return;
  gsap.fromTo(
    element,
    { x: 0, y: 0 },
    {
      x: 2,
      y: 2,
      duration: 0.07,
      ease: "power1.in",
      onComplete: () => {
        gsap.to(element, { x: 0, y: 0, duration: 0.13, ease: "power1.out" });
      },
    },
  );
}

/** One-shot flash on an element, used for success and failure confirmations. */
export function flash(element: HTMLElement, kind: "ok" | "bad"): void {
  const className = kind === "ok" ? "flash-ok" : "flash-bad";
  element.classList.remove(className);
  // Force a reflow so the animation restarts when the same class is re-applied.
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), 1400);
}
