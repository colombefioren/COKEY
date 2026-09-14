import type { FastifyInstance } from "fastify";
import type { Cokey } from "../../core/cokey.js";
import { ProbeModelSchema } from "../../core/validation/schemas.js";
import { matchesQuery, paginate, parsePageQuery } from "../pagination.js";
import { withErrors } from "./http-errors.js";

/**
 * Catalog surfaces: the curated provider dossiers and the ranking boards.
 *
 * The dossiers come from the catalog compiled into this build. The rankings
 * can be replaced wholesale by a published bundle (`POST /api/rankings/refresh`),
 * but only when a person asks for that — there is no background fetch. The
 * probe is the one live endpoint, and the only place a "does this model
 * actually work" answer can come from.
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

  /**
   * The ranking boards.
   *
   * Every board is delivered in one response because the UI shows them as tabs
   * of a single screen, and splitting them would only add a round trip.
   */
  app.get(
    "/api/catalog/rankings",
    withErrors(() => cokey.rankings()),
  );

  /**
   * Fetch the published ranking bundle and replace the boards with it.
   *
   * Only runs when this is called — a person clicking "check for updates" —
   * never on a timer or on startup. A failure changes nothing: the response
   * says why, and the boards already being served keep being served.
   */
  app.post(
    "/api/catalog/rankings/refresh",
    withErrors(async () => {
      const result = await cokey.refreshRankings();
      return result.ok
        ? { changed: true, rankings: result.rankings }
        : { changed: false, message: result.message };
    }),
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

  /**
   * "My models": every model this user can currently use, ranked by their own
   * probe history rather than a curated tier — see `Cokey.myModelRankings`.
   */
  app.get(
    "/api/models/mine",
    withErrors(() => {
      const rankings = cokey.myModelRankings();
      return { rankings, tested: rankings.filter((row) => row.attempts > 0).length };
    }),
  );
}
