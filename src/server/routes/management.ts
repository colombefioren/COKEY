import type { FastifyInstance } from "fastify";
import type { Cokey } from "../../core/cokey.js";
import { unknownQuota } from "../../core/types.js";
import {
  AddEntrySchema,
  ConnectProviderSchema,
  CreateChainSchema,
  CreateCredentialSchema,
  CustomEndpointSchema,
  MoveEntrySchema,
  ProxyUrlSchema,
  ReorderSchema,
  TestSecretSchema,
  UpdateChainSchema,
  UpdateCredentialSchema,
  UpdateEntrySchema,
} from "../../core/validation/schemas.js";
import { matchesQuery, paginate, parsePageQuery } from "../pagination.js";
import { withErrors } from "./http-errors.js";
import { z } from "zod";

/**
 * Management API.
 *
 * Every response here is built from `PublicCredential` projections - there is
 * no code path in this file that can return a stored secret.
 */
const AttachCredentialSchema = z
  .object({
    credentialId: z.string().min(1).optional(),
    secret: z.string().min(1).optional(),
    description: z.string().min(1).max(120).optional(),
    accountId: z.string().min(1).max(200).optional(),
    /** Optional egress proxy bound to the new key. */
    proxyUrl: ProxyUrlSchema.optional(),
    /** Keep an unverifiable credential when the provider is unreachable. */
    addAnyway: z.boolean().optional(),
    /** Keep an unverifiable key: attach it as unverified instead of rejecting. */
    saveAnyway: z.boolean().optional(),
    /** Route the probe through the automatic egress pool. Default true. */
    useProxy: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.credentialId) || Boolean(value.secret), {
    message: "Provide either credentialId or secret",
  });

/**
 * Management API.
 *
 * Every response here is built from `PublicCredential` projections - there is
 * no code path in this file that can return a stored secret.
 */
export function registerManagementRoutes(app: FastifyInstance, cokey: Cokey): void {
  // ---- model catalog ------------------------------------------------------

  /**
   * The curated free-model catalog, annotated with availability.
   *
   * A model is `selectable` only when its provider has a healthy credential,
   * so the picker can never offer a model that has no key behind it.
   */
  app.get(
    "/api/models",
    withErrors(() => {
      const providers = cokey.modelCatalog();
      return {
        providers,
        total: providers.reduce((sum, view) => sum + view.models.length, 0),
        available: providers.filter((view) => view.available).length,
        /**
         * Catalogued models the providers no longer return, across every
         * provider. A single number the dashboard can surface without walking
         * the whole response, and the signal that something needs a re-check.
         */
        stale: providers.reduce((sum, view) => sum + view.staleModels.length, 0),
      };
    }),
  );

  // ---- providers ----------------------------------------------------------

  app.get(
    "/api/providers",
    withErrors((request) => {
      const page = parsePageQuery(request.query, { pageSize: 50 });
      const rows = cokey
        .providerStatuses()
        .filter((row) => matchesQuery(page.query, row.id, row.displayName, row.freeTier.summary));
      return paginate(rows, page);
    }),
  );

  app.post(
    "/api/providers/:id/connect",
    withErrors(async (request) => {
      const { id } = request.params as { id: string };
      const body = ConnectProviderSchema.parse(request.body);
      return cokey.connectProvider(id, body);
    }),
  );

  /**
   * Test a raw key against a provider without storing anything. Drives the
   * separate "Test" button; the verdict is readable in the modal while the key
   * is only saved once the user confirms.
   */
  app.post(
    "/api/providers/:id/test",
    withErrors(async (request) => {
      const { id } = request.params as { id: string };
      const body = TestSecretSchema.parse(request.body);
      const validation = await cokey.testProviderSecret(id, body);
      return { validated: validation.ok, validation };
    }),
  );

  // ---- model inventory ----------------------------------------------------

  /**
   * Ask one provider what it serves right now, and reconcile that with what
   * COKEY believed.
   *
   * This is the per-provider refresh: it retires models the provider stopped
   * returning, restores models that came back, and brings in models the curated
   * catalog never knew about. The response is the change set, so the UI can say
   * what happened instead of just redrawing.
   */
  app.post(
    "/api/providers/:id/refresh-models",
    withErrors(async (request) => {
      const { id } = request.params as { id: string };
      return cokey.refreshProviderModels(id);
    }),
  );

  /**
   * Refresh every connected provider.
   *
   * A distinct path rather than a magic id, so the "refresh everything" action
   * reads as what it is at the call site. Sequentially and politely, because
   * these are third-party endpoints answering an administrative question.
   */
  app.post(
    "/api/providers/refresh-models",
    withErrors(async () => {
      const reports = await cokey.refreshAllProviderModels();
      return {
        reports,
        refreshed: reports.filter((report) => report.ok).length,
        failed: reports.filter((report) => !report.ok).length,
        added: reports.reduce((sum, report) => sum + report.added.length, 0),
        removed: reports.reduce((sum, report) => sum + report.removed.length, 0),
        stale: reports.reduce((sum, report) => sum + report.stale.length, 0),
      };
    }),
  );

  /**
   * The stored model inventory for one provider: when it was checked, and one
   * row per model with whether the provider still returns it.
   */
  app.get(
    "/api/providers/:id/models",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      return cokey.providerModelInventory(id);
    }),
  );

  // ---- guidance -----------------------------------------------------------

  /**
   * Actionable notices derived from live state.
   *
   * A rejected key, a chain node whose model a provider retired, a model list
   * that is three weeks old — each notice names the problem, explains the
   * consequence and carries the actions that fix it.
   */
  app.get(
    "/api/guidance",
    withErrors(() => cokey.guidance()),
  );

  // ---- chains -------------------------------------------------------------

  app.get(
    "/api/chains",
    withErrors(() => cokey.listChains()),
  );

  app.get(
    "/api/chains/:id",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      const chain = cokey.chains.getChain(id);
      if (!chain) throw new Error(`Chain not found: ${id}`);
      return { ...chain, entries: cokey.chains.listEntries(id).map((e) => cokey.entryView(e)) };
    }),
  );

  app.post(
    "/api/chains",
    withErrors((request, reply) => {
      const body = CreateChainSchema.parse(request.body);
      reply.code(201);
      return cokey.chains.createChain(body);
    }),
  );

  app.patch(
    "/api/chains/:id",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      const body = UpdateChainSchema.parse(request.body);
      if (body.alias !== undefined) cokey.chains.renameChain(id, body.alias);
      if (body.description !== undefined) cokey.chains.setChainDescription(id, body.description);
      if (body.enabled !== undefined) cokey.chains.setChainEnabled(id, body.enabled);
      return cokey.chains.getChain(id);
    }),
  );

  app.delete(
    "/api/chains/:id",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      cokey.chains.deleteChain(id);
      return { ok: true };
    }),
  );

  app.post(
    "/api/chains/:id/reorder",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      const body = ReorderSchema.parse(request.body);
      cokey.chains.reorder(id, body.entryIds);
      return { ok: true, entries: cokey.chains.listEntries(id) };
    }),
  );

  // ---- entries ------------------------------------------------------------

  app.get(
    "/api/chains/:id/entries",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      return cokey.chains.listEntries(id).map((entry) => cokey.entryView(entry));
    }),
  );

  app.post(
    "/api/chains/:id/entries",
    withErrors(async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = AddEntrySchema.parse(request.body);

      const catalogEntry = cokey.providers.findCatalogEntry(body.providerId);
      if (!catalogEntry) throw new Error(`Unknown provider: ${body.providerId}`);

      // Credentials may only be bound to entries of their own provider.
      for (const credentialId of body.credentialIds) {
        const credential = cokey.credentials.getOrThrow(credentialId);
        if (credential.providerId !== body.providerId) {
          throw new Error(
            `Credential ${credential.description} belongs to ${credential.providerId}, not ${body.providerId}`,
          );
        }
      }

      reply.code(201);
      const entry = cokey.chains.addEntry({
        chainId: id,
        providerId: body.providerId,
        model: body.model,
        label: body.label,
        baseUrl: catalogEntry.baseUrl,
        credentialIds: body.credentialIds,
        routingStrategy: body.routingStrategy,
        enabled: body.enabled,
      });
      return cokey.entryView(entry);
    }),
  );

  app.patch(
    "/api/entries/:id",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      const body = UpdateEntrySchema.parse(request.body);
      const entry = cokey.chains.getEntryOrThrow(id);

      if (body.model !== undefined) {
        const catalogEntry = cokey.providers.findCatalogEntry(entry.providerId);
        if (!catalogEntry) throw new Error(`Unknown provider: ${entry.providerId}`);
        cokey.chains.updateEntryModel(id, body.model, catalogEntry.baseUrl);
      }
      if (body.label !== undefined) cokey.chains.updateEntryLabel(id, body.label);
      if (body.enabled !== undefined) cokey.chains.setEntryEnabled(id, body.enabled);
      if (body.routingStrategy !== undefined) {
        cokey.chains.setEntryRoutingStrategy(id, body.routingStrategy);
      }
      return cokey.entryView(cokey.chains.getEntryOrThrow(id));
    }),
  );

  app.post(
    "/api/entries/:id/test",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      return cokey.testEntry(id);
    }),
  );

  app.post(
    "/api/entries/:id/duplicate",
    withErrors((request, reply) => {
      const { id } = request.params as { id: string };
      reply.code(201);
      return cokey.entryView(cokey.chains.duplicateEntry(id));
    }),
  );

  app.post(
    "/api/entries/:id/move",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      const body = MoveEntrySchema.parse(request.body);
      const entry = cokey.chains.getEntryOrThrow(id);
      cokey.chains.moveEntry(entry.chainId, id, body.toIndex);
      return { ok: true, entries: cokey.chains.listEntries(entry.chainId) };
    }),
  );

  app.delete(
    "/api/entries/:id",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      cokey.chains.deleteEntry(id);
      return { ok: true };
    }),
  );

  // ---- entry credentials --------------------------------------------------

  app.get(
    "/api/entries/:id/credentials",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      const entry = cokey.chains.getEntryOrThrow(id);
      return cokey.credentials
        .listByIds(entry.credentialIds)
        .map((credential) => cokey.credentials.toPublic(credential));
    }),
  );

  /**
   * Attach a credential to an entry, creating and verifying it when a secret
   * is supplied. This is the mandatory verification gate: an entry only gains
   * a credential that the provider accepted (or an explicit `addAnyway` on a
   * transient network failure).
   */
  app.post(
    "/api/entries/:id/credentials",
    withErrors(async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = AttachCredentialSchema.parse(request.body);
      const entry = cokey.chains.getEntryOrThrow(id);

      if (body.credentialId) {
        const credential = cokey.credentials.getOrThrow(body.credentialId);
        if (credential.providerId !== entry.providerId) {
          throw new Error(
            `Credential ${credential.description} belongs to ${credential.providerId}, not ${entry.providerId}`,
          );
        }
        cokey.chains.addCredentialToEntry(entry.id, credential.id);
        return {
          credential: cokey.credentials.toPublic(credential),
          validation: { ok: true, classification: "success" as const },
          attached: true,
        };
      }

      const catalogEntry = cokey.providers.findCatalogEntry(entry.providerId);
      if (!catalogEntry) throw new Error(`Unknown provider: ${entry.providerId}`);
      if (catalogEntry.credentialFields.includes("accountId") && !body.accountId) {
        throw new Error(`${catalogEntry.displayName} requires an account id`);
      }

      const credential = cokey.credentials.create({
        providerId: entry.providerId,
        accountId: body.accountId,
        secret: body.secret!,
        description: body.description ?? "Untitled",
        proxyUrl: body.proxyUrl,
      });

      const validation = await cokey.verifyCredential(
        entry.providerId,
        entry.model,
        credential,
        body.useProxy !== false,
      );

      if (validation.ok) {
        cokey.credentials.markVerified(credential.id);
      } else if (
        validation.classification === "credential_rate_limited" ||
        validation.classification === "quota_exhausted"
      ) {
        cokey.credentials.putInCooldown(credential.id);
      } else if (validation.classification === "network_error" && body.addAnyway) {
        // Explicit override: keep it, still marked unverified.
      } else if (body.saveAnyway) {
        // Explicit override: the user chose to save this key regardless of
        // whether the probe passed. Keep it, clearly marked unverified.
      } else {
        cokey.credentials.delete(credential.id);
        reply.code(400);
        return {
          error: {
            message:
              validation.classification === "model_unavailable"
                ? `Model ${entry.model} is not available on this key`
                : (validation.message ?? "Credential rejected"),
            type: "credential_rejected",
            classification: validation.classification,
          },
        };
      }

      cokey.chains.addCredentialToEntry(entry.id, credential.id);

      reply.code(201);
      return {
        credential: cokey.credentials.toPublic(cokey.credentials.getOrThrow(credential.id)),
        validation,
        attached: true,
      };
    }),
  );

  app.delete(
    "/api/entries/:id/credentials/:credentialId",
    withErrors((request) => {
      const { id, credentialId } = request.params as { id: string; credentialId: string };
      cokey.chains.removeCredentialFromEntry(id, credentialId);
      return { ok: true };
    }),
  );

  // ---- credentials --------------------------------------------------------

  app.get(
    "/api/credentials",
    withErrors((request) => {
      const page = parsePageQuery(request.query, { pageSize: 50 });
      const rows = cokey.credentials
        .listAll()
        .map((credential) => cokey.credentials.toPublic(credential))
        .filter((credential) =>
          matchesQuery(
            page.query,
            credential.description,
            credential.providerId,
            credential.maskedSecret,
            credential.status,
          ),
        );
      return paginate(rows, page);
    }),
  );

  app.get(
    "/api/credentials/:id",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      return cokey.credentials.toPublic(cokey.credentials.getOrThrow(id));
    }),
  );

  app.post(
    "/api/credentials",
    withErrors(async (request, reply) => {
      const body = CreateCredentialSchema.parse(request.body);
      reply.code(201);
      return cokey.connectProvider(body.providerId, {
        secret: body.secret,
        description: body.description,
        accountId: body.accountId,
      });
    }),
  );

  app.patch(
    "/api/credentials/:id",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      const body = UpdateCredentialSchema.parse(request.body);

      if (body.description !== undefined) cokey.credentials.updateDescription(id, body.description);
      if (body.accountId !== undefined) cokey.credentials.updateAccountId(id, body.accountId);
      if (body.secret !== undefined) cokey.credentials.rotateSecret(id, body.secret);
      if (body.status !== undefined) cokey.credentials.setStatus(id, body.status);
      // Proxy changes go through the facade so validation and the live event
      // feed stay in one place. A pool id wins over a raw URL: the browser
      // never sees a pool proxy's credentials, so assigning from the pool must
      // be resolved server-side.
      if (body.proxyPoolId !== undefined) return cokey.assignCredentialProxy(id, body.proxyPoolId);
      if (body.proxyUrl !== undefined) return cokey.setCredentialProxy(id, body.proxyUrl);

      return cokey.credentials.toPublic(cokey.credentials.getOrThrow(id));
    }),
  );

  app.delete(
    "/api/credentials/:id",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      cokey.chains.detachCredentialEverywhere(id);
      cokey.credentials.delete(id);
      return { ok: true };
    }),
  );

  app.post(
    "/api/credentials/:id/test",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      return cokey.testCredential(id);
    }),
  );

  app.get(
    "/api/credentials/:id/quota",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      const credential = cokey.credentials.getOrThrow(id);
      return {
        credentialId: credential.id,
        description: credential.description,
        providerId: credential.providerId,
        // "Unknown" is a first-class answer here, not an error.
        quota: credential.quota ?? unknownQuota(),
        usage: credential.usage,
      };
    }),
  );

  // ---- custom endpoints ---------------------------------------------------

  app.get(
    "/api/custom-endpoints",
    withErrors(() => cokey.listCustomEndpoints()),
  );

  app.post(
    "/api/custom-endpoints",
    withErrors((request, reply) => {
      const body = CustomEndpointSchema.parse(request.body);
      reply.code(201);
      return cokey.addCustomEndpoint(body);
    }),
  );

  app.delete(
    "/api/custom-endpoints/:id",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      cokey.deleteCustomEndpoint(id);
      return { ok: true };
    }),
  );
}
