import { describe, expect, it } from "vitest";
import { bannerLines } from "../src/cli/banner.js";

describe("bannerLines", () => {
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
    const columns = art.map((line) => line.indexOf("#", 41)).filter((column) => column >= 0);

    expect(columns.length).toBeGreaterThanOrEqual(6);
    expect(new Set(columns).size).toBe(1);
  });

  it("draws two loops, not one blob", () => {
    const middle = art[Math.floor(art.length / 2)] ?? "";
    const mark = middle.slice(0, 41);
    const runs = mark.split("").reduce<number[]>((gaps, cell, index) => {
      if (cell === " " && mark[index - 1] === "#") gaps.push(index);
      return gaps;
    }, []);

    expect(runs.length).toBeGreaterThanOrEqual(3);
  });

  it("leaves no trailing whitespace on any line", () => {
    for (const line of lines) {
      expect(line).toBe(line.replace(/\s+$/, ""));
    }
  });
});
