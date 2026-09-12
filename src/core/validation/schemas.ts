import { z } from "zod";

/** Enum narrowing used by the application layer. */
export const ApiStyleSchema = z.enum(["openai", "anthropic", "google", "cohere", "cloudflare", "ollama"]);
export const AuthSchemeSchema = z.enum(["bearer", "x-api-key", "query-param", "custom-header"]);
export const RoutingStrategySchema = z.enum(["sequential", "round-robin"]);
export const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);

export const ChainAliasSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i, "Use letters, digits, dot, dash or underscore");

/**
 * An egress proxy URL.
 *
 * SOCKS5/SOCKS and HTTP CONNECT are accepted. Credentials may be embedded in
 * the URL (`socks5://user:pass@host:1080`) and are stored encrypted with the
 * key they belong to.
 */
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
  /** Free-form display name chosen by the user. Never auto-generated. */
  label: z.string().max(120).optional(),
  credentialIds: z.array(z.string().min(1)).min(1, "At least one credential is required"),
  routingStrategy: RoutingStrategySchema.optional(),
  enabled: z.boolean().optional(),
});

export const UpdateEntrySchema = z
  .object({
    model: z.string().min(1).optional(),
    /** `null` or an empty string clears the display name. */
    label: z.string().max(120).nullable().optional(),
    enabled: z.boolean().optional(),
    routingStrategy: RoutingStrategySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

/** A live probe of one model through one working key. */
export const ProbeModelSchema = z.object({
  providerId: z.string().min(1),
  model: z.string().min(1),
  /** Pin the probe to a specific key; otherwise the healthiest one is used. */
  credentialId: z.string().min(1).optional(),
  /** Override the probe text. Defaults to a plain hello. */
  message: z.string().max(200).optional(),
});

export const ProxyPoolEntrySchema = z.object({
  url: ProxyUrlSchema,
});

export const UpdateProxyPoolSchema = z
  .object({
    enabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

export const ReorderSchema = z.object({
  entryIds: z.array(z.string().min(1)),
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
    /** `null` clears the proxy and returns the key to direct egress. */
    proxyUrl: ProxyUrlSchema.nullable().optional(),
    /**
     * Pin this key to a specific egress pool entry by id, or `null` to hand it
     * back to the automatic pool. Ids are used rather than URLs because the
     * pool never exposes a proxy's own credentials to the browser.
     */
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
    /** Distribute pool proxies across same-provider keys automatically. */
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

export const ChatCompletionSchema = z.object({
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
}).passthrough();
