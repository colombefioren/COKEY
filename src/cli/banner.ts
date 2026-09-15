import { COKEY_VERSION } from "../version.js";
import { bold, brightMagenta, dim, magenta } from "./format.js";

type Shape = (x: number, y: number) => boolean;

const ROW = 2;

const FILL = "#";
const BLANK = " ";

const THIN = 1.4;

function ring(cx: number, cy: number, radius: number, half: number): Shape {
  return (x, y) => Math.abs(Math.hypot(x - cx, y - cy) - radius) <= half;
}

function bar(x1: number, y1: number, x2: number, y2: number, half: number): Shape {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  return (x, y) => {
    const t =
      lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) <= half;
  };
}

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

const MARK_WIDTH = 41;
const MARK: Shape[] = [
  ring(10, 17, 8.5, 1.8),
  ring(27, 17, 8.5, 1.8),

  leaf(33, 5.5, 5.5, 1.7, -0.55),
  leaf(35.5, 9.5, 3.6, 1.2, -0.55),
];

const GAP = 3;

const WORD_WIDTH = 32;
const WORD: Shape[] = [
  bar(1, 12, 1, 24, THIN),
  bar(1, 18, 8, 12, THIN),
  bar(1, 18, 8, 24, THIN),

  bar(13, 12, 13, 24, THIN),
  bar(12, 12, 19, 12, THIN),
  bar(12, 18, 17, 18, THIN),
  bar(12, 24, 19, 24, THIN),

  bar(22, 12, 26, 18, THIN),
  bar(30, 12, 26, 18, THIN),
  bar(26, 18, 26, 24, THIN),
];

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

export function bannerLines(): string[] {
  const mark = raster(MARK, MARK_WIDTH);
  const word = raster(WORD, WORD_WIDTH);

  const art = mark.map((markLine, row) => {
    const wordLine = word[row] ?? "";
    const joined =
      wordLine.trim().length > 0 ? `${markLine}${BLANK.repeat(GAP)}${wordLine}` : markLine;
    const trimmed = joined.replace(/\s+$/, "");

    return row < 3 ? magenta(trimmed) : brightMagenta(trimmed);
  });

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

export function printBanner(): void {
  console.log(bannerLines().join("\n"));
}
