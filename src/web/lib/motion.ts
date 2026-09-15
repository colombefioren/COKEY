import gsap from "gsap";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function canAnimate(target: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (prefersReducedMotion()) return false;
  return Boolean(target);
}

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

    const size = index % 3 === 0 ? 9 : 6;
    bit.style.width = `${size}px`;
    bit.style.height = `${size}px`;
    bit.style.left = `${originX}px`;
    bit.style.top = `${originY}px`;
    field.appendChild(bit);
    bits.push(bit);
  }

  gsap.to(bits, {
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

export function flash(element: HTMLElement, kind: "ok" | "bad"): void {
  const className = kind === "ok" ? "flash-ok" : "flash-bad";
  element.classList.remove(className);

  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), 1400);
}
