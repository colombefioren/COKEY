import type { CAC } from "cac";
import { divideFreeProviders } from "../../catalog/grouping.js";
import { defineCommand, emit, withCokey } from "../context.js";
import {
  bold,
  cyan,
  dim,
  formatClock,
  green,
  humanizeDuration,
  red,
  statusGlyph,
  table,
  yellow,
} from "../format.js";

/** Read-only inspection commands. */
export function registerInspectCommands(cli: CAC): void {
  defineCommand(cli, "providers", "List catalog providers and free tier status", async (_args, context) => {
    await withCokey(context, (cokey) => {
      const statuses = cokey.providerStatuses();
      const { free, other } = divideFreeProviders(statuses);

      emit(context, statuses, () => {
        console.log(bold(`★ Free providers (${free.length})`));
        for (const provider of free) {
          const state = provider.connected
            ? green(`${provider.credentialCount} key${provider.credentialCount === 1 ? "" : "s"}`)
            : dim("not connected");
          console.log(
            `  ${cyan(provider.id.padEnd(16))} ${provider.displayName.padEnd(24)} ` +
              `${dim(provider.freeTier.summary.padEnd(38))} ${state}`,
          );
        }

        if (other.length > 0) {
          console.log("");
          console.log(bold(`Other supported providers (${other.length})`));
          for (const provider of other) {
            console.log(`  ${provider.id.padEnd(16)} ${provider.displayName}`);
          }
        }

        const custom = cokey.listCustomEndpoints();
        if (custom.length > 0) {
          console.log("");
          console.log(bold(`Custom endpoints (${custom.length})`));
          for (const endpoint of custom) {
            console.log(`  ${endpoint.id.padEnd(24)} ${endpoint.displayName} ${dim(endpoint.baseUrl)}`);
          }
        }
      });
    });
  });

  defineCommand(
    cli,
    "keys [...args]",
    "List credentials (masked), or re-verify one with `keys test <id>`",
    async (args, context) => {
      const [action, id] = args;

      await withCokey(context, async (cokey) => {
        if (action === "test") {
          const credentialId = requireArg(id, "Usage: cokey keys test <credential-id>");
          const before = cokey.credentials.getOrThrow(credentialId);
          const validation = await cokey.testCredential(credentialId);
          const after = cokey.credentials.getOrThrow(credentialId);

          emit(context, { validation, status: after.status }, () => {
            const verdict = validation.ok
              ? green(`✓ verified · ${before.providerId} accepted the key · ${validation.latencyMs ?? 0}ms`)
              : red(`✗ ${validation.classification} · ${validation.message ?? "rejected"}`);
            console.log(`${before.description}: ${verdict}`);
            console.log(dim(`status is now ${after.status}`));
          });
          return;
        }

        if (action !== undefined && action !== "" && action !== "list") {
          throw new Error(`Unknown keys action "${action}". Try: cokey keys test <id>`);
        }

        const credentials = cokey.credentials
          .listAll()
          .map((credential) => cokey.credentials.toPublic(credential));

        emit(context, credentials, () => {
          if (credentials.length === 0) {
            console.log(
              dim("No credentials yet. Connect a provider from the UI or `cokey credentials <file>`."),
            );
            return;
          }

          const rows = credentials.map((credential) => [
            `${statusGlyph(credential.status)} ${credential.status}`,
            credential.providerId,
            credential.description,
            credential.maskedSecret,
            `${credential.usage.requests} req`,
            `${credential.usage.successfulRequests} ok`,
            credential.cooldownUntil && credential.cooldownUntil > Date.now()
              ? `cooldown ${humanizeDuration(credential.cooldownUntil - Date.now())}`
              : "",
          ]);

          console.log(table(["STATE", "PROVIDER", "DESCRIPTION", "KEY", "USAGE", "OK", ""], rows));
          console.log("");
          console.log(
            dim(`Quota is shown per credential in the UI; "unknown" means the provider reports none.`),
          );
        });
      });
    },
  );

  defineCommand(
    cli,
    "requests",
    "Show recent request history",
    async (_args, context) => {
      await withCokey(context, (cokey) => {
        const limit = Number(context.limit ?? 30);
        const entries = cokey.history.list(Number.isFinite(limit) ? limit : 30);
        const stats = cokey.history.stats();

        emit(context, { entries, stats }, () => {
          if (entries.length === 0) {
            console.log(dim("No requests recorded yet."));
            return;
          }
          const rows = entries.map((entry) => [
            formatClock(entry.at),
            entry.chainAlias,
            entry.model,
            entry.credentialDescription,
            entry.outcome === "success" ? green("ok") : red("fail"),
            humanizeDuration(entry.latencyMs),
            entry.fallback ? yellow(entry.fallbackReason ?? "fallback") : "",
            entry.stream ? "stream" : "",
          ]);
          console.log(table(["TIME", "CHAIN", "MODEL", "CREDENTIAL", "", "LATENCY", "FALLBACK", ""], rows));
          console.log("");
          console.log(
            dim(
              `${stats.total} requests · ${stats.success} ok · ${stats.failure} failed · ` +
                `avg ${humanizeDuration(stats.averageLatencyMs)}`,
            ),
          );
        });
      });
    },
    [["--limit <n>", "Maximum rows to show (default 30)"]],
  );

  defineCommand(cli, "stats", "Show aggregate usage statistics", async (_args, context) => {
    await withCokey(context, (cokey) => {
      const stats = cokey.stats();
      emit(context, stats, () => {
        console.log(bold("COKEY statistics"));
        console.log(`  chains:                ${stats.chains}`);
        console.log(`  credentials:           ${stats.credentials}`);
        console.log(`  healthy:               ${green(String(stats.healthyCredentials))}`);
        console.log(`  cooldown:              ${yellow(String(stats.cooldownCredentials))}`);
        console.log(`  invalid:               ${red(String(stats.invalidCredentials))}`);
        console.log(`  providers connected:   ${stats.providersConnected}`);
        console.log(`  requests recorded:     ${stats.history.total}`);
        console.log(`  fallback responses:    ${stats.history.fallbackCount}`);
        console.log(`  average latency:       ${humanizeDuration(stats.history.averageLatencyMs)}`);
        console.log(`  master key source:     ${stats.keySource}`);
      });
    });
  });
}

function requireArg(value: unknown, usage: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(usage);
  return value.trim();
}
