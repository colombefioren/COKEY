// Scratch previewer: renders stroked/filled paths as ASCII so a logo can be
// checked without an image viewer. Deleted after use.
const MODE = process.env.MODE ?? "all";
const ONLY_LETTERS = MODE === "letters";
const COLS = process.env.COLS ? Number(process.env.COLS) : MODE === "letters" ? 200 : 96;
const VIEW_W = MODE === "mark" ? 220 : 440;
const VIEW_H = 128;
const ROWS = Math.round((COLS * VIEW_H) / VIEW_W / 2);

function tokenize(d) {
  const out = [];
  const re = /([MCLZHV])([^MCLZHV]*)/gi;
  let m;
  while ((m = re.exec(d))) {
    const nums = (m[2].match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    out.push({ cmd: m[1].toUpperCase(), nums });
  }
  return out;
}

function cubic(p0, p1, p2, p3, steps = 28) {
  const pts = [];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const a = (1 - t) ** 3;
    const b = 3 * (1 - t) ** 2 * t;
    const c = 3 * (1 - t) * t * t;
    const e = t ** 3;
    pts.push([
      a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1],
    ]);
  }
  return pts;
}

function flatten(d) {
  const subs = [];
  let cur = null;
  let last = null;
  for (const { cmd, nums } of tokenize(d)) {
    if (cmd === "M") {
      cur = [[nums[0], nums[1]]];
      subs.push(cur);
      last = [nums[0], nums[1]];
    } else if (cmd === "C") {
      for (let i = 0; i < nums.length; i += 6) {
        const p1 = [nums[i], nums[i + 1]];
        const p2 = [nums[i + 2], nums[i + 3]];
        const p3 = [nums[i + 4], nums[i + 5]];
        cur.push(...cubic(last, p1, p2, p3));
        last = p3;
      }
    } else if (cmd === "L") {
      cur.push([nums[0], nums[1]]);
      last = [nums[0], nums[1]];
    } else if (cmd === "H") {
      for (const x of nums) {
        cur.push([x, last[1]]);
        last = [x, last[1]];
      }
    } else if (cmd === "V") {
      for (const y of nums) {
        cur.push([last[0], y]);
        last = [last[0], y];
      }
    } else if (cmd === "Z") {
      cur.push(cur[0]);
      last = cur[0];
    }
  }
  return subs;
}

function distToSeg(px, py, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  let t = len === 0 ? 0 : ((px - a[0]) * dx + (py - a[1]) * dy) / len;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx;
  const y = a[1] + t * dy;
  return Math.hypot(px - x, py - y);
}

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const strokes = [
  {
    d: "M84 50 C75 44 63 43 52 50 C32 62 32 90 52 102 C72 114 96 102 96 76 C96 50 120 38 140 50 C160 62 160 90 140 102 C120 114 96 102 96 76",
    w: 13,
  },
  { d: "M246 42 V112 M292 42 L250 76 L292 112", w: 11 },
  { d: "M346 42 H312 V112 H346 M312 76 H338", w: 11 },
  { d: "M378 42 L404 76 L430 42 M404 76 V112", w: 11 },
];

const fills = [
  "M148 46 C152 24 168 6 194 4 C192 30 172 48 148 46 Z",
  "M166 56 C170 36 186 24 212 22 C206 44 188 58 166 56 Z",
];

const chosen = ONLY_LETTERS ? strokes.slice(1) : MODE === "mark" ? strokes.slice(0, 1) : strokes;
const strokePaths = chosen.map((s) => ({ polys: flatten(s.d), w: s.w }));
const fillPolys = ONLY_LETTERS ? [] : fills.map((d) => flatten(d)[0]);

const cellW = VIEW_W / COLS;
const cellH = VIEW_H / ROWS;
const pad = Math.max(cellW, cellH) * 0.6;
const threshold = pad;

let out = "";
for (let r = 0; r < ROWS; r += 1) {
  let line = "";
  for (let c = 0; c < COLS; c += 1) {
    const px = (c + 0.5) * cellW;
    const py = (r + 0.5) * cellH;
    let hit = false;
    for (const { polys, w } of strokePaths) {
      const limit = w / 2 + threshold;
      for (const poly of polys) {
        for (let i = 1; i < poly.length && !hit; i += 1) {
          if (distToSeg(px, py, poly[i - 1], poly[i]) <= limit) hit = true;
        }
        if (hit) break;
      }
      if (hit) break;
    }
    if (!hit) {
      for (const poly of fillPolys) {
        if (pointInPoly(px, py, poly)) {
          hit = true;
          break;
        }
      }
    }
    line += hit ? "#" : " ";
  }
  out += line.replace(/\s+$/, "") + "\n";
}
process.stdout.write(out);
