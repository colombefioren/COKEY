import { COKEY_VERSION } from "../version.js";
import { bold, brightMagenta, dim, magenta } from "./format.js";

/**
 * The logo, in ASCII.
 *
 * Same idea as the mark on the website: a C and an O crossing into an infinity,
 * with two leaves sprouting off the second loop. It only prints when the
 * gateway actually starts, so piping the CLI in a script never has to strip it.
 */
const BS = String.fromCharCode(92);

const LEAVES = ["                             ,/,", "                           ,'  /"];

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

/** The banner as plain lines, with colour applied. */
export function bannerLines(): string[] {
  return [
    ...LEAVES.map((line) => magenta(line)),
    ...LOOPS.map((line) => brightMagenta(line)),
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
