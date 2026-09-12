import { describe, expect, it } from "vitest";
import { bannerLines } from "../src/cli/banner.js";

/**
 * The banner is a drawing, so the tests assert the geometry rather than the
 * characters: if someone edits a line of the mark, the wordmark must not slide
 * out of register and no line may pick up trailing whitespace.
 */
describe("bannerLines", () => {
  // Colour is off under vitest (stdout is not a TTY), so the lines are plain.
  const lines = bannerLines();

  it("draws a twelve line mark with a seven line wordmark beside it", () => {
    // The mark is everything before the blank line that separates it from the
    // version and the tagline.
    const blank = lines.indexOf("");
    expect(blank).toBe(12);

    const art = lines.slice(0, blank);
    const wordRows = art
      .map((line, index) => (line.includes("\u2588") ? index : -1))
      .filter((index) => index >= 0);
    expect(wordRows).toHaveLength(7);

    // Every wordmark row begins in the same column, the whole point of
    // composing the two halves from separate arrays: the mark is 36 columns
    // wide, then a three space gutter.
    const columns = wordRows.map((row) => art[row]!.indexOf("\u2588"));
    expect(new Set(columns).size).toBe(1);
    expect(columns[0]).toBe(39);
  });

  it("keeps the wordmark vertically centred on the mark", () => {
    const wordRows = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.includes("\u2588"))
      .map(({ index }) => index);

    expect(wordRows).toHaveLength(7);
    const centre = (wordRows[0]! + wordRows[wordRows.length - 1]!) / 2;
    // The mark is the first twelve lines; its own centre is line 5.5.
    expect(centre).toBeGreaterThanOrEqual(5);
    expect(centre).toBeLessThanOrEqual(7);
  });

  it("leaves no trailing whitespace on any line", () => {
    for (const line of lines) {
      expect(line).toBe(line.replace(/\s+$/, ""));
    }
  });

  it("names the version and the tagline", () => {
    expect(lines.some((line) => line.includes("C O K E Y"))).toBe(true);
    expect(lines.some((line) => line.includes("broke princess"))).toBe(true);
  });
});
