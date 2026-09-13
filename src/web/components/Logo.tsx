/**
 * The COKEY mark.
 *
 * This is the same artwork as `docs/assets/cokey-logo.svg` in the readme: one
 * continuous line crossing itself into a C and an O, with two leaves off the
 * second loop, then KEY stroked beside it. It is inlined rather than loaded as
 * an image so it stays crisp at any size, inherits nothing from the network,
 * and can re-colour for the active theme through the gradient stops.
 */

const MARK_PATH =
  "M84 50 C75 44 63 43 52 50 C32 62 32 90 52 102 C72 114 96 102 96 76 C96 50 120 38 140 50 C160 62 160 90 140 102 C120 114 96 102 96 76";

/** The mark alone: the CO ligature and the leaves. */
export function CokeyMark({ height = 30, className }: { height?: number; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 128"
      height={height}
      width={(height / 128) * 220}
      role="img"
      aria-label="COKEY"
      fill="none"
    >
      <path
        d={MARK_PATH}
        stroke="currentColor"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M148 46 C152 24 168 6 194 4 C192 30 172 48 148 46 Z" fill="currentColor" />
      <path
        d="M166 56 C170 36 186 24 212 22 C206 44 188 58 166 56 Z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}

/**
 * The full lockup: mark plus the KEY wordmark, matching the readme asset.
 *
 * The gradient ids are suffixed with the `uid` prop so two lockups can sit on
 * one page without one stealing the other's `url(#…)` reference.
 */
export function CokeyLogo({
  height = 26,
  className,
  withWordmark = true,
  uid = "cokey",
}: {
  height?: number;
  className?: string;
  withWordmark?: boolean;
  uid?: string;
}) {
  const viewWidth = withWordmark ? 440 : 220;
  const markId = `${uid}-mark`;
  const wordId = `${uid}-word`;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${viewWidth} 128`}
      height={height}
      width={(height / 128) * viewWidth}
      role="img"
      aria-label="COKEY"
      fill="none"
    >
      <defs>
        <linearGradient
          id={markId}
          x1="24"
          y1="24"
          x2="200"
          y2="118"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#f2a468" />
          <stop offset="0.55" stopColor="#e2662c" />
          <stop offset="1" stopColor="#a1481f" />
        </linearGradient>
        <linearGradient
          id={wordId}
          x1="246"
          y1="42"
          x2="430"
          y2="112"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#f7cba0" />
          <stop offset="1" stopColor="#e2662c" />
        </linearGradient>
      </defs>

      <path
        d={MARK_PATH}
        stroke={`url(#${markId})`}
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M148 46 C152 24 168 6 194 4 C192 30 172 48 148 46 Z" fill="#f2a468" />
      <path d="M166 56 C170 36 186 24 212 22 C206 44 188 58 166 56 Z" fill="#a1481f" />

      {withWordmark ? (
        <g
          stroke={`url(#${wordId})`}
          strokeWidth="11"
          strokeLinecap="square"
          strokeLinejoin="miter"
        >
          <path d="M246 42 V112 M292 42 L250 76 L292 112" />
          <path d="M346 42 H312 V112 H346 M312 76 H338" />
          <path d="M378 42 L404 76 L430 42 M404 76 V112" />
        </g>
      ) : null}
    </svg>
  );
}
