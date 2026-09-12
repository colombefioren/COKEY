import { describe, expect, it } from "vitest";
import { bannerLines } from "../src/cli/banner.js";

/**
 * The banner is a drawing, so these assert the geometry rather than the exact
 * glyphs: the wordmark has to stay in one column whatever the mark does, the
 * canvas has to stay inside a standard terminal, and no line may carry trailing
 * whitespace into a copied-and-pasted bug report.
 */
describe("bannerLines", () => {
  // Colour is off under vitest (stdout is not a TTY), so the lines are plain.
  const lines = bannerLines();

  const blank = lines.indexOf("");
  const art = lines.slice(0, blank);

  it("draws the mark, then the version and the tagline", () => {
    expect(blank).toBeGreaterThan(0);
    expect(lines.some((line) => line.includes("C O K E Y"))).toBe(true);
    expect(lines.some((line) => line.includes("broke princess"))).toBe(true);
  });

  it("fits a standard terminal", () => {
    for (const line of art) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
  });

  it("keeps the wordmark in a single column", () => {
    const columns = art
      .map((line) => line.indexOf("#", 41))
      .filter((column) => column >= 0);

    expect(columns.length).toBeGreaterThanOrEqual(6);
    expect(new Set(columns).size).toBe(1);
  });

  it("draws two loops, not one blob", () => {
    // The widest row of the mark crosses both loops and the gap between them.
    const middle = art[Math.floor(art.length / 2)] ?? "";
    const mark = middle.slice(0, 41);
    const runs = mark.split("").reduce<number[]>((gaps, cell, index) => {
      if (cell === " " && mark[index - 1] === "#") gaps.push(index);
      return gaps;
    }, []);

    // A figure-eight has at least three gaps across its middle: the hollow of
    // each loop, plus the space around them.
    expect(runs.length).toBeGreaterThanOrEqual(3);
  });

  it("leaves no trailing whitespace on any line", () => {
    for (const line of lines) {
      expect(line).toBe(line.replace(/\s+$/, ""));
    }
  });
});
