/**
 * The COKEY mark.
 *
 * One continuous line crossing itself into a C and an O, with two leaves off
 * the second loop, then KEY stroked beside it. It is inlined rather than loaded
 * as an image so it stays crisp at any size, inherits nothing from the network,
 * and can re-colour for the active theme through the gradient stops.
 *
 * The ramp is the brand: baby pink at the start of the stroke, lilac through
 * the middle, violet where it lands. Every appearance of the mark — the rail,
 * the login card, the hub of the live route, the favicon — uses this same
 * three-stop ramp, so the identity is one gradient rather than three
 * approximations of one.
 */

/** The mark alone: the CO ligature and the leaves. */
const MARK_PATH =
  "M84 50 C75 44 63 43 52 50 C32 62 32 90 52 102 C72 114 96 102 96 76 C96 50 120 38 140 50 C160 62 160 90 140 102 C120 114 96 102 96 76";

/** Letterforms for KEY, as single strokes: stem-and-diagonals, three bars, a fork. */
const WORD_PATHS = ["M246 40 V114 M294 40 L250 74 L294 114", "M348 40 H314 V114 H348 M314 74 H340", "M378 40 L406 74 L434 40 M406 74 V114"];

/** The gradient stops, in one place so the svg and the css can never drift. */
const RAMP = [
  { offset: "0", color: "var(--mark-1, #ffb3d4)" },
  { offset: "0.52", color: "var(--mark-2, #b98cf6)" },
  { offset: "1", color: "var(--mark-3, #6b4be0)" },
];

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
      <defs>
        <linearGradient id="cokey-mark-ramp" x1="34" y1="24" x2="196" y2="118" gradientUnits="userSpaceOnUse">
          {RAMP.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
      </defs>

      <path
        d={MARK_PATH}
        stroke="url(#cokey-mark-ramp)"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M148 46 C152 24 168 6 194 4 C192 30 172 48 148 46 Z" fill="var(--mark-1, #ffb3d4)" />
      <path
        d="M166 56 C170 36 186 24 212 22 C206 44 188 58 166 56 Z"
        fill="var(--mark-3, #6b4be0)"
        opacity="0.85"
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
          x1="34"
          y1="24"
          x2="196"
          y2="118"
          gradientUnits="userSpaceOnUse"
        >
          {RAMP.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
        {withWordmark ? (
          <linearGradient id={wordId} x1="248" y1="30" x2="438" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--mark-1, #ffb3d4)" />
            <stop offset="0.6" stopColor="var(--mark-2, #b98cf6)" />
            <stop offset="1" stopColor="var(--mark-3, #6b4be0)" />
          </linearGradient>
        ) : null}
      </defs>

      <path
        d={MARK_PATH}
        stroke={`url(#${markId})`}
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M148 46 C152 24 168 6 194 4 C192 30 172 48 148 46 Z" fill="var(--mark-1, #ffb3d4)" />
      <path
        d="M166 56 C170 36 186 24 212 22 C206 44 188 58 166 56 Z"
        fill="var(--mark-3, #6b4be0)"
        opacity="0.85"
      />

      {withWordmark ? (
        <g
          stroke={`url(#${wordId})`}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {WORD_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      ) : null}
    </svg>
  );
}
