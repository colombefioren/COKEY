#!/usr/bin/env node

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
