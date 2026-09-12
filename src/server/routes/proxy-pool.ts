import type { FastifyInstance } from "fastify";
import type { Cokey } from "../../core/cokey.js";
import {
  BulkProxyPoolSchema,
  FetchProxiflySchema,
  ProxyPoolEntrySchema,
  UpdateProxyPoolSchema,
} from "../../core/validation/schemas.js";
import { withErrors } from "./http-errors.js";

/**
 * Automatic egress pool.
 *
 * The pool exists so that two keys of one provider never leave through the same
 * IP: provider limits are tracked per key *and* per IP, so rotating keys from a
 * single address still trips the same limit. Keys of different providers may
 * share an entry, because nothing correlates them upstream.
 */
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

  /** Re-run assignment on demand, after repairing state by hand. */
  app.post(
    "/api/proxy-pool/sync",
    withErrors(() => ({
      changed: cokey.syncProxyAssignments(),
      entries: cokey.listProxyPool(),
      status: cokey.proxyPoolStatus(),
    })),
  );

  /**
   * Pull Proxifly's free proxy list into the pool.
   *
   * Free proxies are public and shared: the pool grows fast, expectations stay
   * low. Users who need reliability should paste in their own (often paid)
   * entries via `/api/proxy-pool/bulk` instead.
   */
  app.post(
    "/api/proxy-pool/fetch-proxifly",
    withErrors(async (request, reply) => {
      const body = FetchProxiflySchema.parse(request.body ?? {});
      const result = await cokey.addProxiflyFreeList(body.limit);
      reply.code(201);
      return {
        source: "proxifly-free",
        added: result.added,
        skipped: result.skipped,
        entries: result.entries,
        status: result.status,
      };
    }),
  );
}
