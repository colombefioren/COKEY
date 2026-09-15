import { describe, expect, it } from "vitest";
import { COMBINED_RANKING, SKILL_RANKING } from "../src/catalog/rankings.js";
import { modelsForProvider } from "../src/catalog/models.js";

/**
 * A ranking entry names a provider and a model side by side, but that pairing
 * is never checked against the catalog: a provider can drop a model from its
 * free tier and every ranking board that praised it keeps praising it
 * forever. This guards the two boards where the pairing is unambiguous - one
 * `providerId` and one `model`, not a prose list of alternatives - by
 * comparing against `modelsForProvider`, the same lookup the provider catalog
 * itself uses to keep `knownModels` in sync.
 */
function normalize(id: string): string {
  return id
    .toLowerCase()
    .replace(/^[a-z0-9._-]+\//, "")
    .replace(/:free$/, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Not a single, requestable model id: a list of alternatives, or a version wildcard like "3.x". */
function isCompoundModel(model: string): boolean {
  return / or | \/ /.test(model) || /\d+\.x\b/i.test(model);
}

/**
 * A ranking's `model` is a display string ("Poolside laguna-s-2.1", missing
 * the vendor id's slash prefix) or a shortened one ("Qwen3-Coder-480B-A35B",
 * missing the catalog id's "-Instruct" suffix), while a catalog id is a
 * request string ("poolside/laguna-s-2.1", "Qwen/Qwen3-Coder-480B-A35B-
 * Instruct"). Normalizing both to bare alphanumerics still leaves one a
 * strict substring of the other rather than an exact match, so containment
 * (once both are past a trivially short, coincidence-prone length) is what
 * actually lines them up.
 */
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
