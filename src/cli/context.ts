import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CAC } from "cac";
import { Cokey } from "../core/cokey.js";
import { red } from "./format.js";

export interface GlobalOptions {
  dataDir?: string;
  json?: boolean;
}

/** Options cac merges into every action's final argument. */
export interface CommandContext extends GlobalOptions {
  [key: string]: unknown;
}

export function resolveDataDir(options: GlobalOptions = {}): string {
  return options.dataDir ?? process.env.COKEY_DATA_DIR ?? join(process.cwd(), ".cokey");
}

/** Open the application without starting its background sweeper. */
export function openCokey(options: GlobalOptions = {}): Cokey {
  return new Cokey({ dataDir: resolveDataDir(options) });
}

/** Run a function against an open application, always closing the database. */
export async function withCokey<T>(
  options: GlobalOptions,
  fn: (cokey: Cokey) => Promise<T> | T,
): Promise<T> {
  const cokey = openCokey(options);
  try {
    return await fn(cokey);
  } finally {
    cokey.stop();
  }
}

/**
 * A command handler receives the flattened positional arguments and the merged
 * options object, in that order.
 *
 * cac calls an action as `(...declaredArgs, options)`, and it always supplies
 * every declared slot (filling omitted ones with `undefined`). Normalising that
 * here means no handler has to know how many positionals were declared.
 */
export type CommandHandler = (args: string[], context: CommandContext) => Promise<void> | void;

/**
 * Register a command with the shared `--data-dir` option and uniform error
 * handling, so a failure prints one clean line instead of a stack trace.
 */
export function defineCommand(
  cli: CAC,
  name: string,
  description: string,
  handler: CommandHandler,
  extraOptions: Array<[string, string]> = [],
): void {
  let command = cli
    .command(name, description)
    .option("--data-dir <dir>", "COKEY data directory (default: ./.cokey)")
    .option("--json", "Print machine-readable JSON");

  for (const [flag, flagDescription] of extraOptions) {
    command = command.option(flag, flagDescription);
  }

  command.action(async (...raw: unknown[]) => {
    const last = raw[raw.length - 1];
    const hasOptions = Boolean(last) && typeof last === "object" && !Array.isArray(last);
    const context = (hasOptions ? last : {}) as CommandContext;
    const positionals = hasOptions ? raw.slice(0, -1) : raw;

    const args: string[] = [];
    for (const value of positionals) {
      if (Array.isArray(value)) {
        for (const item of value) if (typeof item === "string") args.push(item);
      } else if (typeof value === "string") {
        args.push(value);
      }
    }

    try {
      await handler(args, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(red(`error: ${message}`));
      process.exitCode = 1;
    }
  });
}

/** Print JSON when `--json` was passed, otherwise a human summary. */
export function emit(context: CommandContext, data: unknown, human: () => void): void {
  if (context.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  human();
}

// ---- pidfile --------------------------------------------------------------

export function pidFilePath(dataDir: string): string {
  return join(dataDir, "cokey.pid");
}

export function writePidFile(dataDir: string, pid: number): void {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(pidFilePath(dataDir), String(pid), { mode: 0o600 });
}

export function readPidFile(dataDir: string): number | undefined {
  const path = pidFilePath(dataDir);
  if (!existsSync(path)) return undefined;
  const raw = readFileSync(path, "utf8").trim();
  const pid = Number(raw);
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

export function clearPidFile(dataDir: string): void {
  const path = pidFilePath(dataDir);
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      /* already gone */
    }
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
