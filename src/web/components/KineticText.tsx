import { Fragment, type CSSProperties } from "react";

/**
 * A word that types itself in.
 *
 * Every glyph is its own inline block with a stagger, so a title lands letter
 * by letter instead of sliding in as one slab. That is the whole trick of
 * kinetic type at this scale: the motion is per character, the layout is
 * untouched, and nothing shifts once the last glyph has landed.
 *
 * The container keeps the real string as its accessible name and the glyphs are
 * hidden from the accessibility tree, so a reader hears "Dashboard" once rather
 * than a letter at a time. Spaces stay as plain text: a space with an animation
 * on it would be one more box the line has to lay out for no gain.
 */
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
