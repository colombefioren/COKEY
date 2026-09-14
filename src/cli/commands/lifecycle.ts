import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { platform } from "node:os";
import type { CAC } from "cac";
import { Cokey } from "../../core/cokey.js";
import { startServer } from "../../server/server.js";
import { freeProviders } from "../../catalog/providers.js";
import {
  clearPidFile,
  defineCommand,
  emit,
  isProcessAlive,
  readPidFile,
  resolveDataDir,
  withCokey,
  writePidFile,
  type CommandContext,
} from "../context.js";
import {
  bold,
  bullet,
  cyan,
  dim,
  formatClock,
  green,
  humanizeDuration,
  red,
  yellow,
} from "../format.js";
import { printBanner } from "../banner.js";

/** Register lifecycle commands: start, stop, status, config, doctor. */
export function registerLifecycleCommands(cli: CAC): void {
  const start = cli
    .command("[start]", "Start the COKEY gateway")
    .option("--data-dir <dir>", "COKEY data directory (default: ./.cokey)")
    .option("--port <port>", "Port to bind (default 8787)")
    .option("--host <host>", "Host to bind (default 127.0.0.1)")
    .option("--daemon", "Run in the background and return immediately");

  start.action(async (...raw: unknown[]) => {
    // `[start]` declares one optional positional, so cac supplies it (possibly
    // as undefined) before the options object.
    const last = raw[raw.length - 1];
    const options = (last && typeof last === "object" ? last : {}) as CommandContext;
    try {
      await startGateway(options);
    } catch (error) {
      console.error(red(`error: ${error instanceof Error ? error.message : String(error)}`));
      process.exitCode = 1;
    }
  });

  defineCommand(cli, "stop", "Stop a background COKEY gateway", async (_args, context) => {
    const dataDir = resolveDataDir(context);
    const pid = readPidFile(dataDir);

    if (!pid) {
      console.log("COKEY is not running (no pid file).");
      return;
    }
    if (!isProcessAlive(pid)) {
      clearPidFile(dataDir);
      console.log(dim(`Removed stale pid file for dead process ${pid}.`));
      return;
    }

    process.kill(pid, "SIGTERM");
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (!isProcessAlive(pid)) break;
      await delay(100);
    }

    if (isProcessAlive(pid)) {
      console.log(yellow(`Sent SIGTERM to ${pid}, but it is still running.`));
      return;
    }

    clearPidFile(dataDir);
    console.log(green(`Stopped COKEY (pid ${pid}).`));
  });

  defineCommand(
    cli,
    "status",
    "Show gateway, chain and credential status",
    async (_args, context) => {
      await withCokey(context, async (cokey) => {
        const dataDir = resolveDataDir(context);
        const pid = readPidFile(dataDir);
        const running = pid !== undefined && isProcessAlive(pid);
        const stats = cokey.stats();

        emit(context, { running, pid, ...stats, settings: cokey.settings }, () => {
          console.log(bold("COKEY status"));
          console.log(
            `  gateway:      ${running ? green(`running (pid ${pid})`) : dim("stopped")}`,
          );
          console.log(`  listen:       http://${cokey.settings.host}:${cokey.settings.port}`);
          console.log(`  data dir:     ${stats.dataDir}`);
          console.log(`  master key:   ${stats.keySource}`);
          console.log(
            `  password:     ${cokey.passwordLocked() ? green("set") : yellow("default (coco-the-best)")}`,
          );
          console.log(
            `  credentials:  ${stats.credentials} (${stats.healthyCredentials} healthy, ${stats.cooldownCredentials} cooldown, ${stats.invalidCredentials} invalid)`,
          );
          console.log(`  chains:       ${stats.chains}`);
          console.log("");

          for (const chain of cokey.chains.listChains()) {
            const entries = cokey.chains.listEntries(chain.id);
            const label = chain.enabled ? chain.alias : `${chain.alias} ${dim("(disabled)")}`;
            console.log(`  ${bold(label)} - ${entries.length} entries`);
            for (const entry of entries) {
              const credentials = cokey.credentials.listByIds(entry.credentialIds);
              const healthy = credentials.filter((c) => c.status === "healthy").length;
              const cooldown = credentials.filter((c) => c.status === "cooldown").length;
              const flag = entry.enabled ? "" : dim(" [disabled]");
              console.log(
                `    ${dim(`#${entry.priority}`)} ${entry.providerId} / ${entry.model} - ` +
                  `${credentials.length} keys (${green(`${healthy} healthy`)}, ${yellow(`${cooldown} cooldown`)})${flag}`,
              );
            }
          }

          const recent = cokey.history.list(5);
          if (recent.length > 0) {
            console.log("");
            console.log(`  ${bold("recent requests")}`);
            for (const entry of recent) {
              const outcome = entry.outcome === "success" ? green("ok") : red("fail");
              console.log(
                `    ${dim(formatClock(entry.at))} ${entry.chainAlias} ${entry.model} ` +
                  `${entry.credentialDescription} ${outcome} ${humanizeDuration(entry.latencyMs)}`,
              );
            }
          }
        });
      });
    },
  );

  defineCommand(cli, "config", "Open the COKEY web UI", async (_args, context) => {
    await withCokey(context, async (cokey) => {
      const url = `http://${cokey.settings.host}:${cokey.settings.port}/`;
      console.log(`COKEY UI: ${cyan(url)}`);
      console.log(dim("If the gateway is not running yet, start it with `cokey start`."));
      openInBrowser(url);
    });
  });

  defineCommand(cli, "doctor", "Run local diagnostics", async (_args, context) => {
    await withCokey(context, async (cokey) => {
      const dataDir = resolveDataDir(context);
      const checks: Array<{ ok: boolean; label: string; detail: string }> = [];

      const nodeMajor = Number(process.versions.node.split(".")[0]);
      checks.push({
        ok: nodeMajor >= 20,
        label: "Node.js version",
        detail: `${process.versions.node}${nodeMajor >= 20 ? "" : " (>=20.10 required)"}`,
      });

      let writable = true;
      try {
        accessSync(dataDir, constants.W_OK);
      } catch {
        writable = false;
      }
      checks.push({ ok: writable, label: "Data directory writable", detail: dataDir });

      const stats = cokey.stats();
      checks.push({
        ok: true,
        label: "Master key source",
        detail: `${stats.keySource} (${cokey.vault.keyFingerprint()})`,
      });

      const migrations = cokey.db.appliedMigrations();
      checks.push({
        ok: migrations.length > 0,
        label: "Database migrations",
        detail: `${migrations.length} applied (latest: ${migrations.at(-1)?.name ?? "none"})`,
      });

      const portFree = await isPortFree(cokey.settings.port, cokey.settings.host);
      const pid = readPidFile(dataDir);
      const running = pid !== undefined && isProcessAlive(pid);
      checks.push({
        ok: portFree || running,
        label: "Listen port",
        detail: `http://${cokey.settings.host}:${cokey.settings.port} ${running ? "(gateway running)" : portFree ? "(free)" : "(in use)"}`,
      });

      checks.push({
        ok: cokey.providers.getBuiltInCatalog().length > 0,
        label: "Provider catalog",
        detail: `${cokey.providers.getBuiltInCatalog().length} providers, ${freeProviders().length} advertised free`,
      });

      checks.push({
        ok: stats.invalidCredentials === 0,
        label: "Credentials",
        detail:
          stats.credentials === 0
            ? "none connected yet"
            : `${stats.credentials} total, ${stats.invalidCredentials} invalid`,
      });

      const chainsWithoutCredentials = cokey
        .listChains()
        .filter((chain) => chain.entries.every((entry) => entry.credentialIds.length === 0));
      checks.push({
        ok: chainsWithoutCredentials.length === 0,
        label: "Chains",
        detail:
          chainsWithoutCredentials.length === 0
            ? `${stats.chains} chains configured`
            : `${chainsWithoutCredentials.map((c) => c.alias).join(", ")} have no credentials`,
      });

      const nudge = cokey.freeProviderNudge();

      emit(context, { checks, nudge, stats }, () => {
        console.log(bold("COKEY doctor"));
        for (const check of checks) {
          console.log(`  ${bullet(check.ok)} ${check.label.padEnd(26)} ${dim(check.detail)}`);
        }

        if (cokey.settings.showFreeProviderNudger) {
          console.log("");
          console.log(
            `  ${bold("Maximize failover coverage")} - ${nudge.connectedFree} of ${nudge.target} free providers connected`,
          );
          for (const suggestion of nudge.suggestions.slice(0, 6)) {
            console.log(
              `    ${cyan("•")} ${suggestion.displayName.padEnd(22)} ${dim(suggestion.freeTier.summary)}`,
            );
            console.log(`      ${dim(suggestion.signupUrl)}`);
          }
        }
      });
    });
  });
}

async function startGateway(options: CommandContext): Promise<void> {
  const dataDir = resolveDataDir(options);

  if (options.daemon) {
    const pid = readPidFile(dataDir);
    if (pid && isProcessAlive(pid)) {
      console.log(yellow(`COKEY is already running (pid ${pid}).`));
      return;
    }

    const entry = process.argv[1];
    if (!entry || !entry.endsWith(".js")) {
      console.log(
        yellow(
          "Daemon mode requires the built CLI (`npm run build`, then `node dist/cli/index.js start --daemon`).",
        ),
      );
      return;
    }

    const args = [entry, "start", "--data-dir", dataDir];
    if (options.port) args.push("--port", String(options.port));
    if (options.host) args.push("--host", String(options.host));

    const child = spawn(process.execPath, args, {
      detached: true,
      stdio: "ignore",
      env: process.env,
    });
    child.unref();

    await delay(600);
    const running = readPidFile(dataDir);
    if (running && isProcessAlive(running)) {
      console.log(green(`COKEY started in the background (pid ${running}).`));
    } else {
      console.log(
        yellow(
          "Started, but no pid file appeared. Check the logs or run `cokey start` in the foreground.",
        ),
      );
    }
    return;
  }

  const existing = readPidFile(dataDir);
  if (existing && isProcessAlive(existing)) {
    console.log(yellow(`A COKEY gateway already appears to be running (pid ${existing}).`));
    return;
  }

  const cokey = new Cokey({
    dataDir,
    port: options.port ? Number(options.port) : undefined,
    host: typeof options.host === "string" ? options.host : undefined,
  });
  cokey.start();

  const { app, url } = await startServer(cokey);
  writePidFile(dataDir, process.pid);

  printBanner();
  console.log(`  gateway:  ${cyan(`${url}/v1`)}`);
  console.log(`  ui:       ${cyan(`${url}/`)}`);
  console.log(`  data dir: ${dim(cokey.dataDir)}`);
  console.log(`  master key: ${dim(cokey.vault.keyKind)}`);
  console.log(dim("  Ctrl-C to stop."));

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(dim(`\nReceived ${signal}; shutting down.`));
    try {
      await app.close();
    } catch {
      /* ignore */
    }
    cokey.stop();
    clearPidFile(dataDir);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

function openInBrowser(url: string): void {
  const os = platform();
  const command = os === "darwin" ? "open" : os === "win32" ? "cmd" : "xdg-open";
  const args = os === "win32" ? ["/c", "start", "", url] : [url];
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.unref();
  } catch {
    console.log(dim("Could not open a browser automatically."));
  }
}

function isPortFree(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createNetServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => {
      probe.close(() => resolve(true));
    });
    probe.listen(port, host);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
