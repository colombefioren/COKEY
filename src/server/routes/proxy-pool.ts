import type { FastifyInstance } from "fastify";
import type { Cokey } from "../../core/cokey.js";
import {
  BulkProxyPoolSchema,
  FetchProxiflySchema,
  ProxyPoolEntrySchema,
  UpdateProxyPoolSchema,
  VerifyProxyPoolSchema,
} from "../../core/validation/schemas.js";
import { withErrors } from "./http-errors.js";

export function registerProxyPoolRoutes(app: FastifyInstance, cokey: Cokey): void {
  app.get(
    "/api/proxy-pool",
    withErrors(() => ({
      entries: cokey.listProxyPool(),
      status: cokey.proxyPoolStatus(),
    })),
  );

  app.post(
    "/api/proxy-pool",
    withErrors((request, reply) => {
      const body = ProxyPoolEntrySchema.parse(request.body);
      reply.code(201);
      return {
        entries: cokey.addProxyToPool(body.url),
        status: cokey.proxyPoolStatus(),
      };
    }),
  );

  app.patch(
    "/api/proxy-pool/:id",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      const body = UpdateProxyPoolSchema.parse(request.body);
      const enabled = body.enabled ?? true;
      return {
        entries: cokey.setProxyPoolEnabled(id, enabled),
        status: cokey.proxyPoolStatus(),
      };
    }),
  );

  app.delete(
    "/api/proxy-pool/:id",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      return {
        entries: cokey.removeProxyFromPool(id),
        status: cokey.proxyPoolStatus(),
      };
    }),
  );

  app.post(
    "/api/proxy-pool/bulk",
    withErrors((request, reply) => {
      const body = BulkProxyPoolSchema.parse(request.body);
      const result = cokey.addProxiesToPool(body.text);
      reply.code(201);
      return {
        added: result.added,
        skipped: result.skipped,
        entries: result.entries,
        status: cokey.proxyPoolStatus(),
      };
    }),
  );

  app.post(
    "/api/proxy-pool/sync",
    withErrors(() => ({
      changed: cokey.syncProxyAssignments(),
      entries: cokey.listProxyPool(),
      status: cokey.proxyPoolStatus(),
    })),
  );

  app.post(
    "/api/proxy-pool/fetch-proxifly",
    withErrors(async (request, reply) => {
      const body = FetchProxiflySchema.parse(request.body ?? {});
      const result = await cokey.addProxiflyFreeList(body.limit, {
        verify: body.verify,
        concurrency: body.concurrency,
        timeoutMs: body.timeoutMs,
      });
      reply.code(201);
      return {
        source: "proxifly-free",
        added: result.added,
        skipped: result.skipped,
        checked: result.checked,
        alive: result.alive,
        dead: result.dead,
        entries: result.entries,
        status: result.status,
      };
    }),
  );

  app.post(
    "/api/proxy-pool/check",
    withErrors(async (request) => {
      const body = VerifyProxyPoolSchema.parse(request.body ?? {});
      const result = await cokey.verifyProxyPool({
        concurrency: body.concurrency,
        timeoutMs: body.timeoutMs,
        prune: body.prune,
      });
      return {
        checked: result.checked,
        healthy: result.healthy,
        dead: result.dead,
        removed: result.removed,
        entries: result.entries,
        status: result.status,
      };
    }),
  );
}
