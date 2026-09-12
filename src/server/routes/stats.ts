import type { FastifyInstance } from "fastify";
import { COKEY_VERSION } from "../../version.js";
import type { Cokey } from "../../core/cokey.js";
import { UpdateSettingsSchema } from "../../core/validation/schemas.js";
import { exportConfig } from "../../core/config/export-import.js";
import { streamEvents } from "../streaming/events.js";
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

  /**
   * What the router is doing right now.
   *
   * The route snapshot names the model, the key and the proxy currently in
   * use; `recent` carries the last switch/cooldown notifications so a UI that
   * reloads does not lose the story.
   */
  app.get(
    "/api/status",
    withErrors((request) => {
      const query = request.query as { limit?: string };
      const limit = query.limit ? Number(query.limit) : 30;
      return cokey.liveStatus(Number.isFinite(limit) ? limit : 30);
    }),
  );

  /** Server-sent events for live routing feedback. */
  app.get("/api/events", async (request, reply) => {
    await streamEvents(reply, cokey.events);
    return reply;
  });

  /** Per provider → key → model usage, plus the live route and chain topology. */
  app.get(
    "/api/usage",
    withErrors(() => cokey.usageView()),
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

  // ---- management auth ------------------------------------------------------

  /**
   * Generate or rotate the gateway's management API token.
   *
   * The token is returned in the response body exactly once — it is never
   * retrievable again. The auth middleware is updated in-process so the new
   * token takes effect immediately without a restart.
   */
  app.post(
    "/api/auth-token",
    withErrors((_request, reply) => {
      const token = cokey.generateAuthToken();
      reply.code(201);
      return { authToken: token };
    }),
  );

  /** Revoke the management API token. No body means no auth required. */
  app.delete(
    "/api/auth-token",
    withErrors((_request, _reply) => {
      cokey.clearAuthToken();
      return { ok: true, authTokenConfigured: false };
    }),
  );

  /** Check whether a token is configured (the token itself is never returned). */
  app.get(
    "/api/auth-token",
    withErrors(() => ({ authTokenConfigured: Boolean(cokey.settings.authToken) })),
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
