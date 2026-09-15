export { COKEY_VERSION } from "./version.js";

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

export { createServer, startServer, resolveUiDirectory } from "./server/server.js";
export type { ServerOptions, StartedServer } from "./server/server.js";

export {
  RouterEngine,
  AllChainsExhaustedError,
  RequestScopedError,
  ChainNotFoundError,
  ChainDisabledError,
} from "./core/router/engine.js";
export type {
  AttemptLog,
  RouteErrorInfo,
  RouteResult,
  RouterOptions,
} from "./core/router/engine.js";

export { CredentialManager, CredentialNotFoundError } from "./core/credentials/manager.js";
export { CredentialSelector } from "./core/credentials/selector.js";
export {
  ChainManager,
  ChainNotFoundError as ChainLookupError,
  DuplicateAliasError,
  InvalidAliasError,
  validateAlias,
} from "./core/chains/manager.js";

export {
  classifyError,
  extractMessage,
  isCredentialScoped,
  isEntryScoped,
  isRequestScoped,
  isRetryable,
} from "./core/errors/classify.js";
export {
  CooldownManager,
  DEFAULT_COOLDOWN_POLICY,
  parseRetryAfter,
} from "./core/credentials/cooldown.js";
export type { CooldownPolicy } from "./core/credentials/cooldown.js";
export { parseQuota, parseResetValue } from "./core/quota/parse.js";
export { maskAccountId, maskSecret } from "./core/credentials/masking.js";

export { SecretVault } from "./core/crypto/secrets.js";
export { resolveMasterKey, deriveFromPassphrase } from "./core/crypto/keyring.js";
export type { MasterKey, MasterKeyKind } from "./core/crypto/keyring.js";

export { assertSafeEndpoint, validateEndpointUrl } from "./core/security/ssrf.js";
export type { UrlCheckResult, UrlGuardOptions } from "./core/security/ssrf.js";

export { SettingsService, validateSettings, applyEnvOverrides } from "./core/settings.js";
export { RequestHistory } from "./core/history.js";
export type { HistoryStats, RecordRequestInput } from "./core/history.js";

export {
  exportConfig,
  serializeExport,
  writeExport,
  importConfig,
  importFromFile,
} from "./core/config/export-import.js";
export type {
  CokeyExport,
  ExportedChain,
  ExportedEntry,
  ImportSummary,
} from "./core/config/export-import.js";
export {
  applyCredentialFile,
  loadCredentialFile,
  CredentialFileSchema,
} from "./core/config/credentials-file.js";
export { parseMiniYaml, MiniYamlError } from "./core/config/mini-yaml.js";

export {
  PROVIDER_CATALOG,
  findProvider,
  freeProviders,
  paidProviders,
  providerIds,
  searchProviders,
  isFreeProvider,
} from "./catalog/providers.js";
export { MODELS_BY_PROVIDER, MODEL_CATALOG_SIZE, modelsForProvider } from "./catalog/models.js";
export type { ModelSpec } from "./catalog/models.js";
export { modelAvailability } from "./core/models/availability.js";
export type { ModelCatalogView, SelectableModel } from "./core/models/availability.js";
export {
  ProviderRegistry,
  createAdapter,
  customEndpointToCatalogEntry,
} from "./core/providers/registry.js";
export { OpenAICompatibleAdapter } from "./core/providers/openai-compatible.js";
export type {
  ProviderCatalogEntry,
  ProviderStatus,
  ApiStyle,
  AuthScheme,
} from "./catalog/types.js";
export type {
  ProviderAdapter,
  ProviderRequest,
  SendResult,
  TransformContext,
} from "./core/providers/adapter.js";

export {
  parseProxyUrl,
  dispatcherFor,
  proxyLabel,
  closeProxyDispatchers,
} from "./core/providers/proxy.js";
export type { ParsedProxy, ProxyDispatcher, ProxyProtocol } from "./core/providers/proxy.js";
export { EventBus } from "./core/events.js";
export type {
  CokeyEvent,
  CokeyEventInput,
  CokeyEventType,
  CokeyEventLevel,
  EventListener,
} from "./core/events.js";
export { RateTracker } from "./core/credentials/rate.js";

export { Logger, silentLogger } from "./core/logger.js";
export type { LoggerSink } from "./core/logger.js";

export {
  emptyUsage,
  unknownQuota,
  defaultSettings,
  DEFAULT_FALLBACK_POLICY,
} from "./core/types.js";
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
