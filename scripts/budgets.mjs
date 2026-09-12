#!/usr/bin/env node
/**
 * Build budget guard.
 *
 * COKEY ships a gateway and a dashboard. Both are measured after a production
 * build and compared against a checked-in baseline, so a change that quietly
 * doubles the bundle fails in CI instead of on a user's machine.
 *
 *   node scripts/budgets.mjs check    fail when the build exceeds the baseline
 *   node scripts/budgets.mjs ratchet  rewrite the baseline with the smaller of
 *                                     the measured value and the recorded floor
 */
import { readFileSync, statSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const baselinePath = join(root, ".github/budgets/baseline.json");
const ratchetPath = join(root, ".github/budgets/ratchet.json");

function walk(dir) {
  let bytes = 0;
  let files = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return { bytes, files };
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = walk(full);
      bytes += nested.bytes;
      files += nested.files;
    } else if (statSync(full).isFile()) {
      bytes += statSync(full).size;
      files += 1;
    }
  }
  return { bytes, files };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function measure() {
  const web = walk(join(root, "dist/web"));
  const server = walk(join(root, "dist/cli"));
  const core = walk(join(root, "dist/core"));
  const serverBytes = server.bytes + core.bytes;
  return {
    webBytes: web.bytes,
    serverBytes,
    totalBytes: web.bytes + serverBytes,
    files: web.files + server.files + core.files,
  };
}

const command = process.argv[2] ?? "check";
const measured = measure();

if (measured.totalBytes === 0) {
  console.error("No build output found. Run `npm run build` first.");
  process.exit(1);
}

const baseline = readJson(baselinePath);
const ratchet = readJson(ratchetPath);

const rows = ["webBytes", "serverBytes", "totalBytes", "files"];
const failures = [];

console.log("build budgets");
console.log("metric        measured      baseline      ratchet");
for (const key of rows) {
  const value = measured[key] ?? 0;
  const limit = baseline[key] ?? 0;
  const floor = ratchet[key] ?? 0;
  const ok = value <= limit;
  if (!ok) failures.push(`${key}: ${value} > ${limit}`);
  console.log(
    `${key.padEnd(13)} ${String(value).padStart(9)} ${String(limit).padStart(13)} ${String(floor).padStart(13)} ${ok ? "" : "  OVER"}`,
  );
}

if (command === "ratchet") {
  const next = { ...baseline };
  for (const key of rows) {
    if (typeof measured[key] !== "number") continue;
    if (typeof ratchet[key] === "number" && measured[key] < ratchet[key]) {
      console.error(`Refusing to bank ${key} below the recorded floor.`);
      process.exit(1);
    }
    next[key] = Math.min(baseline[key] ?? measured[key], measured[key]);
  }
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`baseline updated: ${JSON.stringify(next)}`);
  process.exit(0);
}

if (failures.length > 0) {
  console.error(`\nBudget exceeded:\n  ${failures.join("\n  ")}`);
  console.error("Shrink the change or request a maintainer override for the baseline.");
  process.exit(1);
}

console.log("\nAll budgets within the recorded baseline.");
