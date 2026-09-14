import { resolve } from "node:path";
import type { CAC } from "cac";
import { applyCredentialFile, loadCredentialFile } from "../../core/config/credentials-file.js";
import { importFromFile, writeExport } from "../../core/config/export-import.js";
import { defineCommand, emit, withCokey } from "../context.js";
import { bold, cyan, dim, green, yellow } from "../format.js";

/** Configuration portability commands. */
export function registerConfigCommands(cli: CAC): void {
  defineCommand(cli, "export [file]", "Export config (never secrets)", async (args, context) => {
    const [file] = args;
    await withCokey(context, (cokey) => {
      const target = resolve(file && file.trim() ? file : "cokey-export.json");
      writeExport(cokey, target);
      emit(context, { file: target }, () => {
        console.log(green(`Wrote ${target}`));
        console.log(dim("Chains, entry order and labels are included. Secrets are not."));
      });
    });
  });

  defineCommand(
    cli,
    "import <file>",
    "Import config (rebinds existing credentials)",
    async (args, context) => {
      const [file] = args;
      await withCokey(context, (cokey) => {
        if (!file || !file.trim()) throw new Error("Usage: cokey import <file>");
        const source = resolve(file);
        const summary = importFromFile(cokey, source, { settings: context.settings === true });

        emit(context, summary, () => {
          console.log(green(`Imported ${source}`));
          console.log(`  chains created:    ${summary.chainsCreated}`);
          console.log(`  chains updated:    ${summary.chainsUpdated}`);
          console.log(`  entries created:   ${summary.entriesCreated}`);
          console.log(`  entries skipped:   ${summary.entriesSkipped}`);
          console.log(`  credentials bound: ${summary.credentialsMatched}`);
          for (const warning of summary.warnings) console.log(yellow(`  ! ${warning}`));
          if (summary.credentialsMatched === 0) {
            console.log(
              dim("  Add credentials for these providers, then entries become routable."),
            );
          }
        });
      });
    },
    [["--settings", "Also import settings carried in the file"]],
  );

  defineCommand(
    cli,
    "credentials <file>",
    "Create credentials declared in a JSON/YAML file (secrets come from env)",
    async (args, context) => {
      const [file] = args;
      await withCokey(context, (cokey) => {
        if (!file || !file.trim()) throw new Error("Usage: cokey credentials <file>");
        const source = resolve(file);
        const entries = loadCredentialFile(source);
        const result = applyCredentialFile(cokey, entries);

        emit(context, result, () => {
          console.log(bold(`Loaded ${entries.length} credential declaration(s) from ${source}`));
          console.log(`  created:  ${result.created}`);
          console.log(`  attached: ${result.attached}`);
          console.log(`  skipped:  ${result.skipped}`);
          for (const error of result.errors) console.log(yellow(`  ! ${error}`));
        });
      });
    },
  );

  defineCommand(
    cli,
    "endpoints",
    "List custom OpenAI-compatible endpoints",
    async (_args, context) => {
      await withCokey(context, (cokey) => {
        const endpoints = cokey.listCustomEndpoints();
        emit(context, endpoints, () => {
          if (endpoints.length === 0) {
            console.log(dim("No custom endpoints. Add one from the UI's Settings page."));
            return;
          }
          for (const endpoint of endpoints) {
            console.log(
              `${cyan(endpoint.id.padEnd(24))} ${endpoint.displayName} ${dim(endpoint.baseUrl)}`,
            );
          }
        });
      });
    },
  );

  defineCommand(cli, "catalog", "Dump the provider catalog", async (_args, context) => {
    await withCokey(context, (cokey) => {
      const catalog = cokey.providers.getBuiltInCatalog();
      if (context.json) {
        console.log(JSON.stringify(catalog, null, 2));
        return;
      }
      console.log(bold(`${catalog.length} providers in the catalog`));
      for (const provider of catalog) {
        console.log(
          `  ${provider.id.padEnd(16)} ${provider.displayName.padEnd(24)} ` +
            `${provider.knownModels.length} models  ${dim(provider.baseUrl)}`,
        );
      }
      console.log("");
      console.log(dim("Run with --json for the full catalog."));
    });
  });
}
