import type { FastifyInstance } from "fastify";
import { COKEY_VERSION } from "../../version.js";
import type { Cokey } from "../../core/cokey.js";
import { UpdateSettingsSchema } from "../../core/validation/schemas.js";
import { InvalidSettingError } from "../../core/settings.js";
import { exportConfig } from "../../core/config/export-import.js";
import { parseTopics, streamEvents } from "../streaming/events.js";
import { matchesQuery, paginate, parsePageQuery } from "../pagination.js";
import { withErrors } from "./http-errors.js";

export function registerStatsRoutes(app: FastifyInstance, cokey: Cokey): void {
  app.get(
    "/health",
    withErrors(() => ({
      ok: true,
      version: COKEY_VERSION,

      dataDir: cokey.dataDir,
    })),
  );

  app.get(
    "/api/stats",
    withErrors(() => cokey.stats()),
  );

  app.get(
    "/api/status",
    withErrors((request) => {
      const query = request.query as { limit?: string };
      const limit = query.limit ? Number(query.limit) : 30;
      return cokey.liveStatus(Number.isFinite(limit) ? limit : 30);
    }),
  );

  app.get("/api/events", async (request, reply) => {
    const topics = parseTopics((request.query as { topics?: unknown } | undefined)?.topics);
    await streamEvents(reply, cokey.events, topics);
    return reply;
  });

  app.get(
    "/api/usage",
    withErrors(() => cokey.usageView()),
  );

  app.get(
    "/api/requests",
    withErrors((request) => {
      const query = request.query as { outcome?: string; providerId?: string };
      const page = parsePageQuery(request.query, { pageSize: 25 });

      const rows = cokey.history.list(cokey.history.count()).filter((entry) => {
        if (query.outcome && entry.outcome !== query.outcome) return false;
        if (query.providerId && entry.providerId !== query.providerId) return false;
        return matchesQuery(
          page.query,
          entry.chainAlias,
          entry.model,
          entry.providerId,
          entry.credentialDescription,
          entry.classification,
        );
      });

      return { ...paginate(rows, page), stats: cokey.history.stats() };
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

  app.post(
    "/api/password",
    withErrors((request) => {
      const body = request.body as { password?: unknown } | undefined;
      const password = typeof body?.password === "string" ? body.password : "";
      if (!password) throw new InvalidSettingError("A password is required");
      cokey.setPassword(password);
      return { ok: true, passwordLocked: true };
    }),
  );

  app.get(
    "/api/config/export",
    withErrors((_request, reply) => {
      reply.header("content-disposition", 'attachment; filename="cokey-export.json"');
      return exportConfig(cokey);
    }),
  );

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

  app.get(
    "/api/keys",
    withErrors(() => ({ data: cokey.listApiKeys() })),
  );

  app.post(
    "/api/keys",
    withErrors((request, reply) => {
      const body = request.body as { name?: unknown };
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!name) throw new InvalidSettingError("A name is required for the API key");
      reply.code(201);
      return cokey.createApiKey(name);
    }),
  );

  app.delete(
    "/api/keys/:id",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      cokey.revokeApiKey(id);
      return { ok: true };
    }),
  );
}

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
    autoProxy: settings.autoProxy,
    autoProxyStrategy: settings.autoProxyStrategy,
    proxyPoolSize: cokey.proxyPool.size(),
    fallback: settings.fallback,
    passwordLocked: cokey.passwordLocked(),
  };
}
