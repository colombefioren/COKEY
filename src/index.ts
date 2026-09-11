/**
 * COKEY — local LLM credential pool and chain-fallback gateway.
 *
 * Programmatic entry point:
 *
 * ```ts
 * import { Cokey } from "cokey";
 *
 * const cokey = new Cokey({ port: 8787 });
 * await cokey.addChain({
 *   alias: "cokey-best",
 *   entries: [
 *     {
 *       provider: "groq",
 *       model: "qwen/qwen3.8-27b",
 *       credentials: [{ env: "GROQ_KEY_1", description: "Main" }],
 *     },
 *   ],
 * });
 * ```
 */

export { COKEY_VERSION } from "./version.js";

// Application facade
export { Cokey, BadCredentialError } from "./core/cokey.js";
export type {
  CokeyOptions,
  AddChainInput,
  ConnectProviderInput,
  ConnectProviderResult,
  ChainView,
  ChainEntryView,
  CustomEndpointInput,
  FreeProviderNudge,
} from "./core/cokey.js";

// HTTP server
export { createServer, startServer, resolveUiDirectory } from "./server/server.js";
export type { ServerOptions, StartedServer } from "./server/server.js";

// Routing
export {
  RouterEngine,
  AllChainsExhaustedError,
  RequestScopedError,
  ChainNotFoundError,
  ChainDisabledError,
} from "./core/router/engine.js";
export type { AttemptLog, RouteResult, RouterOptions } from "./core/router/engine.js";

// Managers
export { CredentialManager, CredentialNotFoundError } from "./core/credentials/manager.js";
export { CredentialSelector } from "./core/credentials/selector.js";
export { ChainManager, ChainNotFoundError as ChainLookupError, DuplicateAliasError, InvalidAliasError, validateAlias } from "./core/chains/manager.js";

// Classification and policy primitives
export {
  classifyError,
  extractMessage,
  isCredentialScoped,
  isEntryScoped,
  isRequestScoped,
  isRetryable,
} from "./core/errors/classify.js";
export { CooldownManager, DEFAULT_COOLDOWN_POLICY, parseRetryAfter } from "./core/credentials/cooldown.js";
export type { CooldownPolicy } from "./core/credentials/cooldown.js";
export { parseQuota, parseResetValue } from "./core/quota/parse.js";
export { maskAccountId, maskSecret } from "./core/credentials/masking.js";

// Crypto
export { SecretVault } from "./core/crypto/secrets.js";
export { resolveMasterKey, deriveFromPassphrase } from "./core/crypto/keyring.js";
export type { MasterKey, MasterKeyKind } from "./core/crypto/keyring.js";

// Security
export { assertSafeEndpoint, validateEndpointUrl } from "./core/security/ssrf.js";
export type { UrlCheckResult, UrlGuardOptions } from "./core/security/ssrf.js";

// Settings and history
export { SettingsService, validateSettings, applyEnvOverrides } from "./core/settings.js";
export { RequestHistory } from "./core/history.js";
export type { HistoryStats, RecordRequestInput } from "./core/history.js";

// Configuration portability
export {
  exportConfig,
  serializeExport,
  writeExport,
  importConfig,
  importFromFile,
} from "./core/config/export-import.js";
export type { CokeyExport, ExportedChain, ExportedEntry, ImportSummary } from "./core/config/export-import.js";
export { applyCredentialFile, loadCredentialFile, CredentialFileSchema } from "./core/config/credentials-file.js";
export { parseMiniYaml, MiniYamlError } from "./core/config/mini-yaml.js";

// Provider catalog
export {
  PROVIDER_CATALOG,
  findProvider,
  freeProviders,
  paidProviders,
  providerIds,
  searchProviders,
  isFreeProvider,
} from "./catalog/providers.js";
export {
  MODELS_BY_PROVIDER,
  MODEL_CATALOG_SIZE,
  modelsForProvider,
} from "./catalog/models.js";
export type { ModelSpec } from "./catalog/models.js";
export { modelAvailability } from "./core/models/availability.js";
export type { ModelCatalogView, SelectableModel } from "./core/models/availability.js";
export { ProviderRegistry, createAdapter, customEndpointToCatalogEntry } from "./core/providers/registry.js";
export { OpenAICompatibleAdapter } from "./core/providers/openai-compatible.js";
export type { ProviderCatalogEntry, ProviderStatus, ApiStyle, AuthScheme } from "./catalog/types.js";
export type { ProviderAdapter, ProviderRequest, SendResult, TransformContext } from "./core/providers/adapter.js";

// Egress proxies and live routing feedback
export {
  parseProxyUrl,
  dispatcherFor,
  proxyLabel,
  closeProxyDispatchers,
} from "./core/providers/proxy.js";
export type { ParsedProxy, ProxyDispatcher, ProxyProtocol } from "./core/providers/proxy.js";
export { EventBus } from "./core/events.js";
export type { CokeyEvent, CokeyEventInput, CokeyEventType, CokeyEventLevel, EventListener } from "./core/events.js";
export { RateTracker } from "./core/credentials/rate.js";

// Logging
export { Logger, silentLogger } from "./core/logger.js";
export type { LoggerSink } from "./core/logger.js";

// Domain types
export { emptyUsage, unknownQuota, defaultSettings, DEFAULT_FALLBACK_POLICY } from "./core/types.js";
export type {
  Chain,
  ChainEntry,
  ChatCompletionRequest,
  ChatMessage,
  Credential,
  CredentialProxyInfo,
  CredentialRate,
  CredentialStatus,
  ErrorClassification,
  FallbackPolicy,
  LiveRouteSnapshot,
  LogLevel,
  ModelInfo,
  ProviderError,
  PublicCredential,
  QuotaInfo,
  RequestLogEntry,
  RoutingStrategy,
  Settings,
  UsageStats,
  ValidationResult,
} from "./core/types.js";
