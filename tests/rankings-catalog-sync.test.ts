import { describe, expect, it } from "vitest";
import { COMBINED_RANKING, SKILL_RANKING } from "../src/catalog/rankings.js";
import { modelsForProvider } from "../src/catalog/models.js";

function normalize(id: string): string {
  return id
    .toLowerCase()
    .replace(/^[a-z0-9._-]+\//, "")
    .replace(/:free$/, "")
    .replace(/[^a-z0-9]/g, "");
}

function isCompoundModel(model: string): boolean {
  return / or | \/ /.test(model) || /\d+\.x\b/i.test(model);
}

function servesModel(curatedIds: string[], model: string): boolean {
  const target = normalize(model);
  return curatedIds.some((id) => {
    const curated = normalize(id);
    if (curated.length < 4 || target.length < 4) return curated === target;
    return curated === target || target.includes(curated) || curated.includes(target);
  });
}

describe("ranking boards stay in sync with the model catalog", () => {
  it("every clean skill-board entry names a model its provider still serves", () => {
    for (const entry of SKILL_RANKING) {
      if (!entry.providerId || isCompoundModel(entry.model)) continue;
      const curated = modelsForProvider(entry.providerId).map((model) => model.id);
      expect(
        servesModel(curated, entry.model),
        `${entry.providerId} no longer serves ${entry.model} (skill board)`,
      ).toBe(true);
    }
  });

  it("every clean combined-board entry names a model its provider still serves", () => {
    for (const entry of COMBINED_RANKING) {
      if (isCompoundModel(entry.model)) continue;
      const curated = modelsForProvider(entry.providerId).map((model) => model.id);
      expect(
        servesModel(curated, entry.model),
        `${entry.providerId} no longer serves ${entry.model} (combined board)`,
      ).toBe(true);
    }
  });
});
