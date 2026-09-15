import { Fragment, type CSSProperties } from "react";

export function KineticText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {Array.from(text).map((char, index) => (
        <Fragment key={`${char}-${index}`}>
          {char === " " ? (
            " "
          ) : (
            <span
              className="kinetic-glyph"
              style={{ "--glyph": index } as CSSProperties}
              aria-hidden="true"
            >
              {char}
            </span>
          )}
        </Fragment>
      ))}
    </span>
  );
}
