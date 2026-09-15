#!/usr/bin/env node
import { cac } from "cac";
import { red } from "./format.js";
import { COKEY_VERSION } from "../version.js";
import { registerChainCommands } from "./commands/chains.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerInspectCommands } from "./commands/inspect.js";
import { registerLifecycleCommands } from "./commands/lifecycle.js";

const cli = cac("cokey");

registerLifecycleCommands(cli);
registerChainCommands(cli);
registerInspectCommands(cli);
registerConfigCommands(cli);

cli.help();
cli.version(COKEY_VERSION);

try {
  cli.parse(process.argv, { run: true });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(red(`error: ${message}`));
  process.exitCode = 1;
}
