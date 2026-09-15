import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  version: string;
};

export const COKEY_VERSION = packageJson.version;
export const COKEY_USER_AGENT = `cokey/${COKEY_VERSION}`;
