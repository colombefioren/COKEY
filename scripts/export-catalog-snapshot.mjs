#!/usr/bin/env node
/**
 * Snapshot the provider/model catalog for cokey-bundle's admin page.
 *
 * cokey-bundle (github.com/colombefioren/COKEY--BUNDLE) edits the ranking
 * boards in a repo of its own, with no access to this one's TypeScript
 * source. Its admin page still needs to know which providers and models
 * actually exist so a ranking entry can be picked from a list instead of
 * typed by hand - hand-typing an id is exactly how a ranking entry ends up
 * naming a model its provider no longer serves, silently, until someone
 * happens to notice.
 *
 * Run `npm run export:catalog` whenever a provider or model changes, then
 * copy the printed JSON into cokey-bundle's `content/catalog-snapshot.json`
 * and commit it there. This never runs automatically and touches no file in
 * this repo: it only prints to stdout.
 */
import { providerCatalog } from "../src/catalog/providers.js";

const snapshot = {
  generatedAt: new Date().toISOString().slice(0, 10),
  providers: providerCatalog()
    .map((provider) => ({
      id: provider.id,
      displayName: provider.displayName,
      models: [...provider.knownModels].sort(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id)),
};

process.stdout.write(JSON.stringify(snapshot, null, 2) + "\n");
