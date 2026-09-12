/**
 * The COKEY mark.
 *
 * The logo is one line that crosses itself: a C and an O fused into an
 * infinity, with two leaves sprouting off the second loop. It is drawn with
 * `currentColor` so it inherits whatever accent the theme is using, and it
 * carries its own geometry rather than loading an image, which keeps it crisp
 * at every size and free of a network request.
 */

/** The mark alone: the CO ligature and the leaves. */
export function CokeyMark({
  height = 30,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 212 104"
      height={height}
      width={(height / 104) * 212}
      role="img"
      aria-label="COKEY"
      fill="none"
    >
      <path
        d="M96 52 C96 26 72 14 52 26 C32 38 32 66 52 78 C72 90 96 78 96 52 C96 26 120 14 140 26 C160 38 160 66 140 78 C120 90 96 78 96 52"
        stroke="currentColor"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M150 27 C150 8 168 0 191 2 C189 23 170 35 150 27 Z" fill="currentColor" />
      <path d="M161 35 C169 18 187 12 205 15 C197 33 179 43 161 35 Z" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/**
 * The full lockup: mark plus the KEY wordmark.
 *
 * The letters are stroke-drawn rather than typed, so the wordmark never depends
 * on a font being installed and keeps the same weight as the mark.
 */
export function CokeyLogo({
  height = 26,
  className,
  withWordmark = true,
}: {
  height?: number;
  className?: string;
  withWordmark?: boolean;
}) {
  const viewWidth = withWordmark ? 420 : 212;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${viewWidth} 104`}
      height={height}
      width={(height / 104) * viewWidth}
      role="img"
      aria-label="COKEY"
      fill="none"
    >
      <path
        d="M96 52 C96 26 72 14 52 26 C32 38 32 66 52 78 C72 90 96 78 96 52 C96 26 120 14 140 26 C160 38 160 66 140 78 C120 90 96 78 96 52"
        stroke="currentColor"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M150 27 C150 8 168 0 191 2 C189 23 170 35 150 27 Z" fill="currentColor" />
      <path d="M161 35 C169 18 187 12 205 15 C197 33 179 43 161 35 Z" fill="currentColor" opacity="0.6" />
      {withWordmark ? (
        <g stroke="currentColor" strokeWidth="10" strokeLinecap="square" strokeLinejoin="miter">
          <path d="M236 16 V88 M278 16 L240 52 L278 88" />
          <path d="M330 16 H300 V88 H330 M300 52 H322" />
          <path d="M362 16 L386 48 L410 16 M386 48 V88" />
        </g>
      ) : null}
    </svg>
  );
}
