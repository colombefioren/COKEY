#!/usr/bin/env node
/**
 * Vendor the dashboard's web fonts.
 *
 * COKEY is a local-first tool: it makes no outbound request on the user's
 * behalf and it ships no telemetry. Loading a font from a CDN at runtime would
 * break both of those promises for the sake of a heading, so the fonts are
 * downloaded once, committed under `src/web/public/fonts`, and served by the
 * gateway like any other asset.
 *
 * Run with `npm run fonts` when a family or weight is added. The script is
 * idempotent: unchanged files are left alone, so a re-run is a no-op.
 *
 * One family: Bricolage Grotesque, at the weights the dashboard actually uses
 * (regular text, medium labels, semibold headings, bold emphasis). It is a
 * single modern grotesque with enough character in its letterforms — flat-cut
 * terminals on the lowercase a/g, a slightly condensed rhythm — to read as a
 * deliberate choice rather than the Inter/Manrope default every generated
 * dashboard reaches for.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src", "web", "public", "fonts");
const CSS_OUT = join(ROOT, "src", "web", "styles", "fonts.css");

/**
 * A browser-ish User-Agent is required: the Google Fonts CSS API serves woff2
 * only to clients that advertise support for it, and answers legacy clients
 * with much larger ttf links.
 */
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Families to vendor, with the slug used for their file names. */
const FAMILIES = [
  {
    query: "Bricolage+Grotesque:wght@400;500;600;700;800",
    slug: "bricolage-grotesque",
    display: "Bricolage Grotesque",
  },
];

async function get(url) {
  const response = await fetch(url, { headers: { "user-agent": UA } });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response;
}

/**
 * Pair each subset comment with the `@font-face` block that follows it.
 *
 * The API emits one block per subset and per weight, each introduced by a
 * comment naming the subset. Only `latin` is kept: the app is English-only, and
 * committing eight subsets per weight would multiply the vendored bytes for
 * glyphs nothing renders.
 */
const FACE_PATTERN =
  /\/\*\s*([a-z0-9-]+)\s*\*\/\s*@font-face\s*\{([\s\S]*?)\}/g;

function parseFaces(css) {
  const faces = [];
  for (const match of css.matchAll(FACE_PATTERN)) {
    const [, subset, body] = match;
    const weight = /font-weight:\s*([^;]+);/.exec(body)?.[1]?.trim();
    const style = /font-style:\s*([^;]+);/.exec(body)?.[1]?.trim() ?? "normal";
    const url = /src:\s*url\(([^)]+)\)/.exec(body)?.[1];
    if (subset !== "latin" || !weight || !url) continue;
    faces.push({ weight, style, url });
  }
  return faces;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const declarations = [];
  let downloaded = 0;
  let reused = 0;

  for (const family of FAMILIES) {
    const url = `https://fonts.googleapis.com/css2?family=${family.query}&display=swap`;
    const css = await (await get(url)).text();
    const faces = parseFaces(css);

    if (faces.length === 0) {
      console.warn(`! no latin faces for ${family.slug}`);
      continue;
    }

    // A variable font answers every requested weight with the same URL: one
    // file whose `wght` axis covers the whole range, not a distinct static
    // instance per weight. Fetching and committing that file five times would
    // ship identical bytes five times over; a single @font-face with a weight
    // *range* is both smaller and the textbook-correct way to self-host it,
    // since the browser then picks the exact instance from the one file.
    const byUrl = new Map();
    for (const face of faces) {
      const group = byUrl.get(face.url) ?? [];
      group.push(face);
      byUrl.set(face.url, group);
    }

    for (const [srcUrl, group] of byUrl) {
      const weights = group.map((face) => Number(face.weight)).sort((a, b) => a - b);
      const isVariable = group.length > 1;
      const weightLabel = isVariable
        ? `${weights[0]} ${weights[weights.length - 1]}`
        : group[0].weight;
      const weightSlug = isVariable
        ? "variable"
        : weightLabel.replace(/[^0-9]/g, "-").replace(/-+/g, "-");
      const file = `${family.slug}-${weightSlug}.woff2`;
      const target = join(OUT_DIR, file);

      if (existsSync(target)) {
        reused += 1;
      } else {
        const bytes = Buffer.from(await (await get(srcUrl)).arrayBuffer());
        await writeFile(target, bytes);
        downloaded += 1;
        console.log(`+ ${file} (${(bytes.length / 1024).toFixed(1)} KiB)`);
      }

      declarations.push({ family, weight: weightLabel, style: group[0].style, file });
    }
  }

  // Group by family so the emitted sheet reads like a hand-written one.
  const byFamily = new Map();
  for (const face of declarations) {
    const list = byFamily.get(face.family.slug) ?? [];
    list.push(face);
    byFamily.set(face.family.slug, list);
  }

  const lines = [
    "/*",
    " * Self-hosted dashboard fonts. GENERATED by scripts/fetch-fonts.mjs.",
    " *",
    " * Do not edit by hand: change the family list in the script and run",
    " * `npm run fonts`. The files live in src/web/public/fonts and are served by",
    " * the gateway, so the UI makes no outbound request to render text.",
    " */",
    "",
  ];

  for (const [, faces] of byFamily) {
    const display = faces[0].family.display;
    lines.push(`/* ${display} */`);
    for (const face of faces) {
      lines.push(
        "@font-face {",
        `  font-family: "${display}";`,
        `  font-style: ${face.style};`,
        `  font-weight: ${face.weight};`,
        "  font-display: swap;",
        `  src: url("/fonts/${face.file}") format("woff2");`,
        "}",
        "",
      );
    }
  }

  await writeFile(CSS_OUT, lines.join("\n"));
  console.log(
    `\n${declarations.length} face(s) written to styles/fonts.css ` +
      `(${downloaded} downloaded, ${reused} already present)`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
