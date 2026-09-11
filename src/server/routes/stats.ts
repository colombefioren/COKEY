import type { FastifyInstance } from "fastify";
import { COKEY_VERSION } from "../../version.js";
import type { Cokey } from "../../core/cokey.js";
import { UpdateSettingsSchema } from "../../core/validation/schemas.js";
import { exportConfig } from "../../core/config/export-import.js";
import { withErrors } from "./http-errors.js";

/** Reporting, configuration and health endpoints. */
export function registerStatsRoutes(app: FastifyInstance, cokey: Cokey): void {
  app.get(
    "/health",
    withErrors(() => ({
      ok: true,
      version: COKEY_VERSION,
      // Never include secrets or key material here.
      dataDir: cokey.dataDir,
    })),
  );

  app.get(
    "/api/stats",
    withErrors(() => cokey.stats()),
  );

  app.get(
    "/api/requests",
    withErrors((request) => {
      const query = request.query as { limit?: string };
      const limit = query.limit ? Number(query.limit) : 100;
      return {
        data: cokey.history.list(Number.isFinite(limit) ? limit : 100),
        stats: cokey.history.stats(),
      };
    }),
  );

  app.delete(
    "/api/requests",
    withErrors(() => {
      cokey.history.clear();
      return { ok: true };
    }),
  );

  app.get(
    "/api/settings",
    withErrors(() => publicSettings(cokey)),
  );

  app.patch(
    "/api/settings",
    withErrors((request) => {
      const body = UpdateSettingsSchema.parse(request.body);
      cokey.settingsService.update(body);
      cokey.logger.setLevel(cokey.settings.logLevel);
      return publicSettings(cokey);
    }),
  );

  app.post(
    "/api/settings/reset",
    withErrors(() => {
      cokey.settingsService.reset();
      return publicSettings(cokey);
    }),
  );

  /**
   * Portable configuration export.
   *
   * Built from `exportConfig`, which deliberately contains no secrets — the
   * Settings screen links straight to this endpoint.
   */
  app.get(
    "/api/config/export",
    withErrors((_request, reply) => {
      reply.header("content-disposition", 'attachment; filename="cokey-export.json"');
      return exportConfig(cokey);
    }),
  );

  /** The local free-provider "incite" payload. */
  app.get(
    "/api/nudge",
    withErrors(() => {
      const nudge = cokey.freeProviderNudge();
      const settings = cokey.settings;
      return {
        enabled: settings.showFreeProviderNudger,
        ...nudge,
        suggestions: nudge.suggestions.map((entry) => ({
          id: entry.id,
          displayName: entry.displayName,
          summary: entry.freeTier.summary,
          signupUrl: entry.signupUrl,
        })),
      };
    }),
  );
}

/** Settings projection that never leaks the auth token. */
function publicSettings(cokey: Cokey): Record<string, unknown> {
  const settings = cokey.settings;
  return {
    port: settings.port,
    host: settings.host,
    logLevel: settings.logLevel,
    dataDir: settings.dataDir,
    showFreeProviderNudger: settings.showFreeProviderNudger,
    freeProviderTarget: settings.freeProviderTarget,
    allowPrivateEndpoints: settings.allowPrivateEndpoints,
    fallback: settings.fallback,
    authTokenConfigured: Boolean(settings.authToken),
  };
}
