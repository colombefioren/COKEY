import type { CAC } from "cac";
import type { Cokey } from "../../core/cokey.js";
import type { ChainEntry } from "../../core/types.js";
import { defineCommand, emit, withCokey, type CommandContext } from "../context.js";
import { bold, dim, green, red } from "../format.js";

/**
 * Chain commands.
 *
 * cac matches a command by its first token, so `cokey chains reorder …` cannot
 * be a multi-word command name. One `chains` command therefore takes a
 * subcommand argument and dispatches here, which also makes the bare
 * `cokey chains` listing the default.
 */
export function registerChainCommands(cli: CAC): void {
  defineCommand(
    cli,
    "chains [...args]",
    "List chains, or modify them: create, delete, add, remove, reorder, move, enable, disable, strategy",
    async (args, context) => {
      const [action, target, ...refs] = args;
      await withCokey(context, (cokey) => {
        switch (action) {
          case undefined:
          case "":
          case "list":
            return listChains(cokey, context);
          case "create":
            return createChain(cokey, context, target);
          case "delete":
            return deleteChain(cokey, context, target);
          case "add":
            return addEntry(cokey, context, target, refs[0]);
          case "remove":
            return removeEntry(cokey, context, target, refs[0]);
          case "reorder":
            return reorderEntries(cokey, context, target, refs);
          case "move":
            return moveEntry(cokey, context, target, refs[0]);
          case "enable":
            return setEntryEnabled(cokey, context, target, refs[0], true);
          case "disable":
            return setEntryEnabled(cokey, context, target, refs[0], false);
          case "strategy":
            return setStrategy(cokey, context, target, refs[0], refs[1]);
          default:
            throw new Error(
              `Unknown chains action "${action}". Try: create, delete, add, remove, reorder, move, enable, disable, strategy`,
            );
        }
      });
    },
    [["--to <index>", "Target position for `chains move`"]],
  );

  defineCommand(cli, "entries", "List every entry across all chains", async (_args, context) => {
    await withCokey(context, (cokey) => {
      const rows = cokey.listChains().flatMap((chain) =>
        chain.entries.map((entry) => ({ chain: chain.alias, ...entry })),
      );
      emit(context, rows, () => {
        if (rows.length === 0) {
          console.log(dim("No entries yet."));
          return;
        }
        for (const row of rows) {
          console.log(
            `${bold(row.chain)} #${row.priority} ${row.providerId}/${row.model} ` +
              `${row.enabled ? "" : red("[disabled]")} ${dim(`${row.credentialIds.length} keys`)}`,
          );
        }
      });
    });
  });
}

// ---- actions ---------------------------------------------------------------

function listChains(cokey: Cokey, context: CommandContext): void {
  const chains = cokey.listChains();
  emit(context, chains, () => {
    if (chains.length === 0) {
      console.log(dim("No chains yet. Create one with `cokey chains create <alias>`."));
      return;
    }
    for (const chain of chains) {
      const header = chain.enabled ? bold(chain.alias) : `${bold(chain.alias)} ${dim("(disabled)")}`;
      console.log(header + (chain.description ? ` ${dim(`— ${chain.description}`)}` : ""));
      if (chain.entries.length === 0) {
        console.log(dim("  (no entries)"));
        continue;
      }
      for (const entry of chain.entries) {
        console.log(
          `  ${dim(`${entry.priority}.`)} ${entry.providerId} / ${entry.model}  ` +
            `${dim(`${entry.credentials.length} keys`)}` +
            (entry.enabled ? "" : ` ${red("[disabled]")}`),
        );
      }
      console.log("");
    }
  });
}

function createChain(cokey: Cokey, context: CommandContext, alias?: string): void {
  const name = requireArg(alias, "Usage: cokey chains create <alias>");
  const chain = cokey.chains.createChain({
    alias: name,
    description: typeof context.description === "string" ? context.description : undefined,
  });
  emit(context, chain, () => console.log(green(`Created chain ${bold(chain.alias)} (${chain.id})`)));
}

function deleteChain(cokey: Cokey, context: CommandContext, alias?: string): void {
  const chain = resolveChain(cokey, requireArg(alias, "Usage: cokey chains delete <alias>"));
  cokey.chains.deleteChain(chain.id);
  emit(context, { ok: true }, () => console.log(green(`Deleted chain ${chain.alias}.`)));
}

function addEntry(cokey: Cokey, context: CommandContext, alias?: string, reference?: string): void {
  const chain = resolveChain(cokey, requireArg(alias, "Usage: cokey chains add <alias> <provider:model>"));
  const ref = parseEntryRef(requireArg(reference, "Usage: cokey chains add <alias> <provider:model>"));

  const catalogEntry = cokey.providers.findCatalogEntry(ref.providerId);
  if (!catalogEntry) throw new Error(`Unknown provider: ${ref.providerId}`);
  if (!ref.model) {
    throw new Error(`Specify a model, e.g. ${ref.providerId}:${catalogEntry.knownModels[0] ?? "<model>"}`);
  }

  // Bind every credential already stored for this provider so the entry is
  // immediately usable, matching the UI's default selection.
  const credentialIds = cokey.credentials.listByProvider(ref.providerId).map((c) => c.id);

  const entry = cokey.chains.addEntry({
    chainId: chain.id,
    providerId: ref.providerId,
    model: ref.model,
    baseUrl: catalogEntry.baseUrl,
    credentialIds,
  });

  emit(context, entry, () =>
    console.log(
      green(
        `Added ${entry.providerId}/${entry.model} to ${chain.alias} as #${entry.priority} ` +
          `(${credentialIds.length} credentials bound)`,
      ),
    ),
  );
}

function removeEntry(cokey: Cokey, context: CommandContext, alias?: string, reference?: string): void {
  const chain = resolveChain(cokey, requireArg(alias, "Usage: cokey chains remove <alias> <provider:model>"));
  const entry = resolveEntry(cokey, chain.id, requireArg(reference, "Missing entry reference"));
  cokey.chains.deleteEntry(entry.id);
  emit(context, { ok: true }, () =>
    console.log(green(`Removed ${entry.providerId}/${entry.model} from ${chain.alias}.`)),
  );
}

function reorderEntries(cokey: Cokey, context: CommandContext, alias?: string, refs: string[] = []): void {
  const chain = resolveChain(
    cokey,
    requireArg(alias, "Usage: cokey chains reorder <alias> <provider:model> [more...]"),
  );
  if (refs.length === 0) throw new Error("Provide at least one entry reference");

  const orderedIds = refs.map((ref) => resolveEntry(cokey, chain.id, ref).id);
  cokey.chains.reorder(chain.id, orderedIds);

  const entries = cokey.chains.listEntries(chain.id);
  emit(context, entries, () => {
    console.log(green(`Reordered ${chain.alias}:`));
    for (const entry of entries) {
      console.log(`  ${dim(String(entry.priority).padStart(2))}. ${entry.providerId}/${entry.model}`);
    }
  });
}

function moveEntry(cokey: Cokey, context: CommandContext, alias?: string, reference?: string): void {
  const chain = resolveChain(
    cokey,
    requireArg(alias, "Usage: cokey chains move <alias> <provider:model> --to <index>"),
  );
  const entry = resolveEntry(cokey, chain.id, requireArg(reference, "Missing entry reference"));
  const to = Number(context.to);

  if (!Number.isInteger(to) || to < 0) {
    throw new Error("Pass a zero-based target with --to <index>");
  }

  cokey.chains.moveEntry(chain.id, entry.id, to);
  emit(context, cokey.chains.listEntries(chain.id), () =>
    console.log(green(`Moved ${entry.providerId}/${entry.model} to position ${to}.`)),
  );
}

function setEntryEnabled(
  cokey: Cokey,
  context: CommandContext,
  alias: string | undefined,
  reference: string | undefined,
  enabled: boolean,
): void {
  const chain = resolveChain(
    cokey,
    requireArg(alias, `Usage: cokey chains ${enabled ? "enable" : "disable"} <alias> <provider:model>`),
  );
  const entry = resolveEntry(cokey, chain.id, requireArg(reference, "Missing entry reference"));
  cokey.chains.setEntryEnabled(entry.id, enabled);
  emit(context, { ok: true }, () =>
    console.log(
      green(`${enabled ? "Enabled" : "Disabled"} ${entry.providerId}/${entry.model} in ${chain.alias}.`),
    ),
  );
}

function setStrategy(
  cokey: Cokey,
  context: CommandContext,
  alias?: string,
  reference?: string,
  strategy?: string,
): void {
  const chain = resolveChain(
    cokey,
    requireArg(alias, "Usage: cokey chains strategy <alias> <provider:model> <sequential|round-robin>"),
  );
  const entry = resolveEntry(cokey, chain.id, requireArg(reference, "Missing entry reference"));
  const value = String(strategy ?? "");
  if (value !== "sequential" && value !== "round-robin") {
    throw new Error("Strategy must be `sequential` or `round-robin`");
  }
  cokey.chains.setEntryRoutingStrategy(entry.id, value);
  emit(context, { ok: true }, () =>
    console.log(green(`${entry.providerId}/${entry.model} now uses ${value} routing.`)),
  );
}

// ---- helpers ---------------------------------------------------------------

function requireArg(value: unknown, usage: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(usage);
  return value.trim();
}

export function resolveChain(cokey: Cokey, alias: string) {
  const chain = cokey.chains.getChainByAlias(alias);
  if (!chain) throw new Error(`Chain not found: ${alias}`);
  return chain;
}

/**
 * Resolve `provider` or `provider:model` to an entry.
 *
 * Model ids may themselves contain colons (`openrouter:deepseek/x:free`), so
 * only the first colon separates the provider from the model.
 */
export function parseEntryRef(reference: string): { providerId: string; model?: string } {
  const index = reference.indexOf(":");
  if (index === -1) return { providerId: reference };
  return { providerId: reference.slice(0, index), model: reference.slice(index + 1) || undefined };
}

export function resolveEntry(cokey: Cokey, chainId: string, reference: string): ChainEntry {
  const { providerId, model } = parseEntryRef(reference);
  const matches = cokey.chains
    .listEntries(chainId)
    .filter((entry) => entry.providerId === providerId && (!model || entry.model === model));

  if (matches.length === 0) throw new Error(`No entry matches ${reference}`);
  if (matches.length > 1) throw new Error(`${reference} matches ${matches.length} entries; include the model`);
  return matches[0]!;
}
