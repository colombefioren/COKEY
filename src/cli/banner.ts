import { COKEY_VERSION } from "../version.js";
import { bold, brightMagenta, dim, magenta } from "./format.js";

/**
 * The logo, in ASCII.
 *
 * It mirrors `docs/assets/cokey-logo.svg` line for line: the mark is one drawn
 * line that starts at the open terminal of the C, crosses itself into an
 * infinity, and closes the O, with two leaves sprouting off the second loop.
 * The wordmark sits to its right, at the same weight, so the terminal shows the
 * same lockup the README and the sidebar show.
 *
 * The mark and the wordmark are kept as separate arrays and aligned at print
 * time, so editing one line can never push the other half out of register.
 * It only prints when the gateway actually starts, so piping the CLI in a
 * script never has to strip it.
 */
const BS = String.fromCharCode(92);

/** The two leaves that sprout from the top of the second loop. */
const LEAVES = ["                            ,/,", "                          ,'  /"];

/** The figure-eight: a C and an O sharing one crossing. */
const LOOPS = [
  "   _.-''''-._          _.-''''-._",
  " .'          '.      .'          '.",
  `/              ${BS}    /              ${BS}`,
  `|               ${BS}  /               |`,
  `|                ${BS}/                |`,
  `|                /${BS}                |`,
  `|               /  ${BS}               |`,
  `${BS}              /    ${BS}              /`,
  " '.          .'      '.          .'",
  "   '-......-'          '-......-'",
];

const MARK = [...LEAVES, ...LOOPS];

/**
 * The KEY wordmark, as seven-row pixel grids.
 *
 * An SVG stroke can be given a width; a terminal cell cannot. A solid block
 * character is the closest a monospace font gets to the wordmark's 11px stroke,
 * which is why the letters are filled rather than outlined.
 */
const LETTERS: string[][] = [
  ["█   █", "█  █", "█ █", "██", "█ █", "█  █", "█   █"], // K
  ["█████", "█", "█", "████", "█", "█", "█████"], // E
  ["█   █", "█   █", " █ █", "  █", "  █", "  █", "  █"], // Y
];

/** Lay the letters side by side, padding each one so the rows stay in line. */
function wordmark(): string[] {
  const widths = LETTERS.map((rows) => Math.max(...rows.map((row) => row.length)));
  const height = Math.max(...LETTERS.map((rows) => rows.length));
  const lines: string[] = [];

  for (let row = 0; row < height; row += 1) {
    const cells = LETTERS.map((rows, index) => (rows[row] ?? "").padEnd(widths[index] ?? 0));
    lines.push(cells.join("  ").replace(/\s+$/, ""));
  }
  return lines;
}

const WORD = wordmark();
const MARK_WIDTH = Math.max(...MARK.map((line) => line.length));

/** Vertically centre the wordmark against the mark, the way the SVG does. */
const WORD_TOP = Math.round((MARK.length - WORD.length) / 2);

/** The banner as plain lines, with colour applied. */
export function bannerLines(): string[] {
  const art = MARK.map((line, index) => {
    const paint = index < LEAVES.length ? magenta : brightMagenta;
    const right = WORD[index - WORD_TOP];
    // Only pad the rows that carry a wordmark line, so the rest of the art is
    // free of trailing whitespace when colour is off.
    const left = paint(right ? line.padEnd(MARK_WIDTH) : line);
    return right ? `${left}   ${brightMagenta(right)}` : left;
  });

  return [
    ...art,
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
