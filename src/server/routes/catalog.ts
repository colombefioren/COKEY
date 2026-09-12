import type { FastifyInstance } from "fastify";
import type { Cokey } from "../../core/cokey.js";
import { ProbeModelSchema } from "../../core/validation/schemas.js";
import {
  COMBINED_RANKING,
  DROP_LIST,
  RANKING_BOTTOM_LINE,
  RANKING_DISCLAIMER,
  RANKING_SOURCES,
  RATE_LIMIT_RANKING,
  REDUNDANCY_TABLE,
  SKILL_RANKING,
  SKILL_TIERS,
} from "../../catalog/rankings.js";
import { providerDossier } from "../../catalog/dossiers.js";
import { matchesQuery, paginate, parsePageQuery } from "../pagination.js";
import { withErrors } from "./http-errors.js";

/**
 * Catalog surfaces: the curated provider dossiers and the three ranking boards.
 *
 * All of this is static reference data plus one live endpoint, the probe, which
 * is the only place a "does this model actually work" answer can come from.
 */
export function registerCatalogRoutes(app: FastifyInstance, cokey: Cokey): void {
  /** Provider dossiers joined with connection state, paginated and searchable. */
  app.get(
    "/api/catalog/providers",
    withErrors((request) => {
      const page = parsePageQuery(request.query);
      const statuses = cokey.providerStatuses();

      const rows = statuses
        .map((status) => ({
          ...status,
          dossier: providerDossier(status.id),
        }))
        .filter((row) =>
          matchesQuery(
            page.query,
            row.id,
            row.displayName,
            row.dossier.operator,
            row.dossier.origin,
            row.dossier.summary,
          ),
        )
        .sort((a, b) => {
          const verdictRank = { recommended: 0, usable: 1, limited: 2, avoid: 3 } as const;
          const delta = verdictRank[a.dossier.verdict] - verdictRank[b.dossier.verdict];
          return delta !== 0 ? delta : a.displayName.localeCompare(b.displayName);
        });

      return paginate(rows, page);
    }),
  );

  /**
   * The ranking boards.
   *
   * The three boards are delivered in one response because the UI shows them as
   * tabs of a single screen, and splitting them would only add a round trip.
   */
  app.get(
    "/api/catalog/rankings",
    withErrors(() => ({
      tiers: SKILL_TIERS,
      skill: SKILL_RANKING,
      rateLimit: RATE_LIMIT_RANKING,
      combined: COMBINED_RANKING,
      redundancy: REDUNDANCY_TABLE,
      dropList: DROP_LIST,
      bottomLine: RANKING_BOTTOM_LINE,
      disclaimer: RANKING_DISCLAIMER,
      sources: RANKING_SOURCES,
    })),
  );

  /**
   * Probe one model through one working key.
   *
   * The play button. It sends a real completion ("hello" by default) so a green
   * check means a 200 came back, not that a record in the database says healthy.
   */
  app.post(
    "/api/models/probe",
    withErrors(async (request) => {
      const body = ProbeModelSchema.parse(request.body);
      return cokey.probeModel(body.providerId, body.model, body.credentialId, body.message);
    }),
  );
}
