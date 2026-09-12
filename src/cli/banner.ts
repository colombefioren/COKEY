import { COKEY_VERSION } from "../version.js";
import { bold, brightMagenta, dim, magenta } from "./format.js";

/**
 * The logo, as terminal art.
 *
 * It is the same drawing as `docs/assets/cokey-logo.svg`: two loops sharing one
 * crossing, so the left reads as a C and the right as an O, two leaves off the
 * second loop, and the KEY wordmark at the same weight to its right.
 *
 * The art is rasterised from that geometry rather than typed out by hand. A
 * monospace cell is roughly twice as tall as it is wide, so every shape is
 * measured in cell *widths* and the row axis is doubled; that one fact is the
 * whole reason the loops come out round instead of squashed, and it is also why
 * a hand-typed banner never quite looks like the SVG.
 *
 * It only prints when the gateway actually starts, so piping the CLI in a
 * script never has to strip it.
 */

/** A filled shape: true when the point (x, y) is inside it. */
type Shape = (x: number, y: number) => boolean;

/** A monospace cell is about twice as tall as it is wide. */
const ROW = 2;

const FILL = "#";
const BLANK = " ";

/** Stroke half-width of the letters, in cell widths. */
const THIN = 1.4;

/** A stroked circle: everything within `half` of the radius. */
function ring(cx: number, cy: number, radius: number, half: number): Shape {
  return (x, y) => Math.abs(Math.hypot(x - cx, y - cy) - radius) <= half;
}

/** A round-capped stroke between two points. */
function bar(x1: number, y1: number, x2: number, y2: number, half: number): Shape {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  return (x, y) => {
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) <= half;
  };
}

/** A filled leaf: an ellipse tilted by `angle` radians. */
function leaf(cx: number, cy: number, major: number, minor: number, angle: number): Shape {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    return (u * u) / (major * major) + (v * v) / (minor * minor) <= 1;
  };
}

const ROWS = 14;

/**
 * The mark: the C and the O meeting at one point, plus the two leaves.
 *
 * The two loops are tangent (the distance between their centres is exactly the
 * diameter), which is what makes the left one read as a C and the right one as
 * an O, instead of a symmetrical infinity.
 */
const MARK_WIDTH = 41;
const MARK: Shape[] = [
  ring(10, 17, 8.5, 1.8),
  ring(27, 17, 8.5, 1.8),
  // The leaves clear the right loop's shoulder instead of sitting on it.
  leaf(33, 5.5, 5.5, 1.7, -0.55),
  leaf(35.5, 9.5, 3.6, 1.2, -0.55),
];

/** How many columns sit between the mark and the wordmark. */
const GAP = 3;

/**
 * The KEY wordmark, drawn as strokes so it carries the mark's weight.
 *
 * Horizontal bars sit on even `y`, because a row is sampled at its centre: an
 * even `y` falls between two rows and fills both, an odd one sits on a single
 * row and comes out hairline.
 */
const WORD_WIDTH = 32;
const WORD: Shape[] = [
  // K
  bar(1, 12, 1, 24, THIN),
  bar(1, 18, 8, 12, THIN),
  bar(1, 18, 8, 24, THIN),
  // E
  bar(13, 12, 13, 24, THIN),
  bar(12, 12, 19, 12, THIN),
  bar(12, 18, 17, 18, THIN),
  bar(12, 24, 19, 24, THIN),
  // Y
  bar(22, 12, 26, 18, THIN),
  bar(30, 12, 26, 18, THIN),
  bar(26, 18, 26, 24, THIN),
];

/**
 * Rasterise a shape list into a grid of characters.
 *
 * Each cell is tested at its centre, in a space where one unit is one cell
 * *width*, so the shapes are measured in real screen proportions.
 */
function raster(shapes: Shape[], width: number, rows = ROWS): string[] {
  const lines: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    let line = "";
    for (let col = 0; col < width; col += 1) {
      const x = col + 0.5;
      const y = row * ROW + ROW / 2;
      line += shapes.some((shape) => shape(x, y)) ? FILL : BLANK;
    }
    lines.push(line);
  }
  return lines;
}

/** The banner as plain lines, with colour applied. */
export function bannerLines(): string[] {
  const mark = raster(MARK, MARK_WIDTH);
  const word = raster(WORD, WORD_WIDTH);

  const art = mark.map((markLine, row) => {
    const wordLine = word[row] ?? "";
    const joined =
      wordLine.trim().length > 0 ? `${markLine}${BLANK.repeat(GAP)}${wordLine}` : markLine;
    const trimmed = joined.replace(/\s+$/, "");
    // Rows above the loops carry only the leaves, which sit one shade deeper.
    return row < 3 ? magenta(trimmed) : brightMagenta(trimmed);
  });

  // Blank rows at the top or bottom of the canvas would print as gaps, so the
  // art is trimmed back to the glyphs even when a shape moves.
  const first = art.findIndex((line) => line.length > 0);
  const last = art.reduce((found, line, index) => (line.length > 0 ? index : found), -1);

  return [
    ...art.slice(first, last + 1),
    "",
    `  ${bold("C O K E Y")}  ${dim(`v${COKEY_VERSION}`)}`,
    `  ${dim("a tool for broke lads made by a broke princess")}`,
    "",
  ];
}

/** Print the banner. Kept separate from the formatting so it can be tested. */
export function printBanner(): void {
  console.log(bannerLines().join("\n"));
}
