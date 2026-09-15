import type { FastifyInstance } from "fastify";
import type { Cokey } from "../../core/cokey.js";
import { ProbeModelSchema } from "../../core/validation/schemas.js";
import { matchesQuery, paginate, parsePageQuery } from "../pagination.js";
import { withErrors } from "./http-errors.js";

export function registerCatalogRoutes(app: FastifyInstance, cokey: Cokey): void {
  app.get(
    "/api/catalog/providers",
    withErrors((request) => {
      const page = parsePageQuery(request.query);
      const statuses = cokey.providerStatuses();

      const rows = statuses
        .map((status) => ({
          ...status,
          dossier: cokey.providerDossier(status.id),
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

  app.get(
    "/api/catalog/rankings",
    withErrors(() => cokey.rankings()),
  );

  app.post(
    "/api/catalog/rankings/refresh",
    withErrors(async () => {
      const result = await cokey.refreshRankings();
      return result.ok
        ? { changed: true, rankings: result.rankings }
        : { changed: false, message: result.message };
    }),
  );

  app.post(
    "/api/models/probe",
    withErrors(async (request) => {
      const body = ProbeModelSchema.parse(request.body);
      return cokey.probeModel(body.providerId, body.model, body.credentialId, body.message);
    }),
  );

  app.get(
    "/api/models/mine",
    withErrors(() => {
      const rankings = cokey.myModelRankings();
      return { rankings, tested: rankings.filter((row) => row.attempts > 0).length };
    }),
  );
}
