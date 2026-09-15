import { z } from "zod";

export const ApiStyleSchema = z.enum([
  "openai",
  "anthropic",
  "google",
  "cohere",
  "cloudflare",
  "ollama",
]);
export const AuthSchemeSchema = z.enum(["bearer", "x-api-key", "query-param", "custom-header"]);
export const RoutingStrategySchema = z.enum(["sequential", "round-robin"]);
export const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);

export const ChainAliasSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i, "Use letters, digits, dot, dash or underscore");

export const ProxyUrlSchema = z
  .string()
  .min(1)
  .max(300)
  .refine(
    (value) => /^(socks5|socks|socks5h|https?):\/\//i.test(value),
    "Use socks5://, socks:// or http(s)://",
  );

export const ConnectProviderSchema = z.object({
  secret: z.string().min(1, "API key is required"),
  description: z.string().min(1, "Description is required").max(120),
  accountId: z.string().min(1).max(200).optional(),
  proxyUrl: ProxyUrlSchema.optional(),

  saveAnyway: z.boolean().optional(),

  useProxy: z.boolean().optional(),
});

export const TestSecretSchema = z.object({
  secret: z.string().min(1, "API key is required"),
  accountId: z.string().min(1).max(200).optional(),

  model: z.string().min(1).optional(),

  useProxy: z.boolean().optional(),
});

export const CreateChainSchema = z.object({
  alias: ChainAliasSchema,
  description: z.string().max(280).optional(),
});

export const UpdateChainSchema = z
  .object({
    alias: ChainAliasSchema.optional(),
    description: z.string().max(280).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

export const AddEntrySchema = z.object({
  providerId: z.string().min(1),
  model: z.string().min(1),

  label: z.string().max(120).optional(),
  credentialIds: z.array(z.string().min(1)).min(1, "At least one credential is required"),
  routingStrategy: RoutingStrategySchema.optional(),
  enabled: z.boolean().optional(),
});

export const UpdateEntrySchema = z
  .object({
    model: z.string().min(1).optional(),

    label: z.string().max(120).nullable().optional(),
    enabled: z.boolean().optional(),
    routingStrategy: RoutingStrategySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

export const ProbeModelSchema = z.object({
  providerId: z.string().min(1),
  model: z.string().min(1),

  credentialId: z.string().min(1).optional(),

  message: z.string().max(200).optional(),
});

export const ProxyPoolEntrySchema = z.object({
  url: ProxyUrlSchema,
});

export const BulkProxyPoolSchema = z.object({
  text: z.string().min(1, "Paste at least one proxy URL").max(20_000),
});

export const FetchProxiflySchema = z.object({
  limit: z.number().int().min(1).max(2_000).optional(),

  verify: z.boolean().optional(),

  concurrency: z.number().int().min(1).max(100).optional(),

  timeoutMs: z.number().int().min(250).max(30_000).optional(),
});

export const VerifyProxyPoolSchema = z
  .object({
    concurrency: z.number().int().min(1).max(100).optional(),

    timeoutMs: z.number().int().min(250).max(30_000).optional(),

    prune: z.boolean().optional(),
  })
  .strict();

export const UpdateProxyPoolSchema = z
  .object({
    enabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

export const ReorderSchema = z.object({
  entryIds: z.array(z.string().min(1)),
});

export const ReorderChainsSchema = z.object({
  chainIds: z.array(z.string().min(1)),
});

export const MoveEntrySchema = z.object({
  toIndex: z.number().int().min(0),
});

export const CreateCredentialSchema = z.object({
  providerId: z.string().min(1),
  secret: z.string().min(1),
  description: z.string().min(1).max(120),
  accountId: z.string().min(1).max(200).optional(),
  proxyUrl: ProxyUrlSchema.optional(),
});

export const UpdateCredentialSchema = z
  .object({
    description: z.string().min(1).max(120).optional(),
    accountId: z.string().max(200).nullable().optional(),
    secret: z.string().min(1).optional(),
    status: z.enum(["healthy", "cooldown", "invalid", "disabled", "unverified"]).optional(),

    proxyUrl: ProxyUrlSchema.nullable().optional(),

    proxyPoolId: z.string().min(1).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

export const UpdateSettingsSchema = z
  .object({
    port: z.number().int().min(0).max(65535).optional(),
    host: z.string().min(1).optional(),
    logLevel: LogLevelSchema.optional(),
    showFreeProviderNudger: z.boolean().optional(),
    freeProviderTarget: z.number().int().min(0).max(50).optional(),
    allowPrivateEndpoints: z.boolean().optional(),

    autoProxy: z.boolean().optional(),
    autoProxyStrategy: z.enum(["per-provider", "round-robin"]).optional(),
    fallback: z
      .object({
        enabled: z.boolean().optional(),
        credentialFallback: z.boolean().optional(),
        entryFallback: z.boolean().optional(),
        maxRetriesPerCredential: z.number().int().min(0).max(10).optional(),
        cooldownAutomatic: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

export const CustomEndpointSchema = z.object({
  displayName: z.string().min(1).max(120),
  baseUrl: z.string().url(),
  apiStyle: ApiStyleSchema.default("openai"),
  authScheme: AuthSchemeSchema.default("bearer"),
  models: z.array(z.string().min(1)).default([]),
});

export const ChatCompletionSchema = z
  .object({
    model: z.string().min(1),
    messages: z
      .array(
        z
          .object({
            role: z.string().min(1),
            content: z.unknown().optional(),
          })
          .passthrough(),
      )
      .min(1, "messages must contain at least one message"),
    stream: z.boolean().optional(),
  })
  .passthrough();
