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
  ReorderChainsSchema,
  ReorderSchema,
  TestSecretSchema,
  UpdateChainSchema,
  UpdateCredentialSchema,
  UpdateEntrySchema,
} from "../../core/validation/schemas.js";
import { matchesQuery, paginate, parsePageQuery } from "../pagination.js";
import { withErrors } from "./http-errors.js";
import { z } from "zod";

const AttachCredentialSchema = z
  .object({
    credentialId: z.string().min(1).optional(),
    secret: z.string().min(1).optional(),
    description: z.string().min(1).max(120).optional(),
    accountId: z.string().min(1).max(200).optional(),

    proxyUrl: ProxyUrlSchema.optional(),

    addAnyway: z.boolean().optional(),

    saveAnyway: z.boolean().optional(),

    useProxy: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.credentialId) || Boolean(value.secret), {
    message: "Provide either credentialId or secret",
  });

export function registerManagementRoutes(app: FastifyInstance, cokey: Cokey): void {
  app.get(
    "/api/models",
    withErrors(() => {
      const providers = cokey.modelCatalog();
      return {
        providers,
        total: providers.reduce((sum, view) => sum + view.models.length, 0),
        available: providers.filter((view) => view.available).length,

        stale: providers.reduce((sum, view) => sum + view.staleModels.length, 0),
      };
    }),
  );

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

  app.post(
    "/api/providers/:id/test",
    withErrors(async (request) => {
      const { id } = request.params as { id: string };
      const body = TestSecretSchema.parse(request.body);
      return cokey.testProviderSecret(id, body);
    }),
  );

  app.post(
    "/api/providers/:id/refresh-models",
    withErrors(async (request) => {
      const { id } = request.params as { id: string };
      return cokey.refreshProviderModels(id);
    }),
  );

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

  app.get(
    "/api/providers/:id/models",
    withErrors((request) => {
      const { id } = request.params as { id: string };
      return cokey.providerModelInventory(id);
    }),
  );

  app.get(
    "/api/guidance",
    withErrors(() => cokey.guidance()),
  );

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
    "/api/chains/reorder",
    withErrors((request) => {
      const body = ReorderChainsSchema.parse(request.body);
      cokey.chains.reorderChains(body.chainIds);
      return { ok: true, chains: cokey.listChains() };
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
      } else if (
        !(validation.classification === "network_error" && body.addAnyway) &&
        !body.saveAnyway
      ) {
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

        quota: credential.quota ?? unknownQuota(),
        usage: credential.usage,
      };
    }),
  );

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
