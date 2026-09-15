const MARK_PATH =
  "M84 50 C75 44 63 43 52 50 C32 62 32 90 52 102 C72 114 96 102 96 76 C96 50 120 38 140 50 C160 62 160 90 140 102 C120 114 96 102 96 76";

const WORD_PATHS = [
  "M246 40 V114 M294 40 L250 74 L294 114",
  "M348 40 H314 V114 H348 M314 74 H340",
  "M378 40 L406 74 L434 40 M406 74 V114",
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

export function CokeyLogo({
  height = 26,
  className,
  withWordmark = true,
}: {
  height?: number;
  className?: string;
  withWordmark?: boolean;

  uid?: string;
}) {
  const viewWidth = withWordmark ? 440 : 220;

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

      {withWordmark ? (
        <g
          stroke="currentColor"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.88"
        >
          {WORD_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      ) : null}
    </svg>
  );
}
