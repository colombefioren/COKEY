import { randomBytes } from "node:crypto";
import type { SettingsRepo } from "./db/settings.repo.js";
import {
  DEFAULT_FALLBACK_POLICY,
  defaultSettings,
  type FallbackPolicy,
  type LogLevel,
  type Settings,
} from "./types.js";

const SETTINGS_KEY = "settings";
const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];
const AUTH_TOKEN_KEY = "authToken";
const AUTH_TOKEN_BYTES = 32;

export class InvalidSettingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSettingError";
  }
}

/**
 * A settings patch may touch individual fallback knobs without replacing the
 * whole policy object, which is what the Settings screen sends.
 */
export type SettingsPatch = Partial<Omit<Settings, "fallback">> & {
  fallback?: Partial<FallbackPolicy>;
};

/**
 * Owns the gateway configuration.
 *
 * Precedence, lowest to highest: built-in defaults → persisted row →
 * environment variables. Environment variables win so a container can pin the
 * port without rewriting the database.
 */
export class SettingsService {
  private current: Settings;

  constructor(
    private readonly repo: SettingsRepo,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {
    this.current = this.compute();
  }

  get(): Settings {
    return { ...this.current, fallback: { ...this.current.fallback } };
  }

  /** Recompute from storage and environment. */
  reload(): Settings {
    this.current = this.compute();
    return this.get();
  }

  /** Merge a validated patch and persist it. */
  update(patch: SettingsPatch): Settings {
    const merged = validateSettings({
      ...this.current,
      ...patch,
      fallback: { ...this.current.fallback, ...(patch.fallback ?? {}) },
    });
    this.repo.setJson(SETTINGS_KEY, merged);
    this.current = this.compute();
    return this.get();
  }

  updateFallbackPolicy(patch: Partial<FallbackPolicy>): Settings {
    return this.update({ fallback: { ...this.current.fallback, ...patch } });
  }

  /** Restore defaults, discarding the persisted row. */
  reset(): Settings {
    this.repo.delete(SETTINGS_KEY);
    this.current = this.compute();
    return this.get();
  }

  /**
   * Generate a fresh management API token, persist it as the gateway's auth
   * bearer token, and return it (once — it is never stored in plaintext by
   * the caller).
   */
  generateAuthToken(): string {
    const token = randomBytes(AUTH_TOKEN_BYTES).toString("hex");
    this.repo.setJson(AUTH_TOKEN_KEY, token);
    this.current = this.compute();
    return token;
  }

  /** Clear the management API token, reverting to no-auth mode. */
  clearAuthToken(): void {
    this.repo.delete(AUTH_TOKEN_KEY);
    this.current = this.compute();
  }

  private compute(): Settings {
    const defaults = defaultSettings(this.env.COKEY_DATA_DIR || process.cwd() + "/.cokey");
    const stored = this.repo.getJson<Partial<Settings>>(SETTINGS_KEY) ?? {};
    const storedToken = this.repo.getJson<string>(AUTH_TOKEN_KEY) ?? undefined;

    const base = validateSettings({
      ...defaults,
      ...stored,
      ...(storedToken ? { authToken: storedToken } : {}),
      fallback: { ...DEFAULT_FALLBACK_POLICY, ...(stored.fallback ?? {}) },
    });

    return applyEnvOverrides(base, this.env);
  }
}

export function validateSettings(settings: Settings): Settings {
  const port = Number(settings.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new InvalidSettingError(`Invalid port: ${settings.port}`);
  }
  if (!settings.host || typeof settings.host !== "string") {
    throw new InvalidSettingError("Invalid host");
  }
  if (!LOG_LEVELS.includes(settings.logLevel)) {
    throw new InvalidSettingError(`Invalid log level: ${settings.logLevel}`);
  }
  if (!settings.dataDir || typeof settings.dataDir !== "string") {
    throw new InvalidSettingError("Invalid data directory");
  }

  const freeProviderTarget = Number(settings.freeProviderTarget);
  if (!Number.isInteger(freeProviderTarget) || freeProviderTarget < 0 || freeProviderTarget > 50) {
    throw new InvalidSettingError(`Invalid free provider target: ${settings.freeProviderTarget}`);
  }

  const policy = settings.fallback ?? DEFAULT_FALLBACK_POLICY;
  const maxRetriesPerCredential = Number(policy.maxRetriesPerCredential);
  if (!Number.isInteger(maxRetriesPerCredential) || maxRetriesPerCredential < 0 || maxRetriesPerCredential > 10) {
    throw new InvalidSettingError(`Invalid max retries per credential: ${policy.maxRetriesPerCredential}`);
  }

  return {
    ...settings,
    port,
    freeProviderTarget,
    authToken: settings.authToken || undefined,
    fallback: { ...policy, maxRetriesPerCredential },
  };
}

/** Environment overrides, applied last so they always win. */
export function applyEnvOverrides(settings: Settings, env: NodeJS.ProcessEnv): Settings {
  const next: Settings = { ...settings, fallback: { ...settings.fallback } };

  if (env.COKEY_PORT) {
    const port = Number(env.COKEY_PORT);
    if (Number.isInteger(port) && port >= 0 && port <= 65535) next.port = port;
  }
  if (env.COKEY_HOST) next.host = env.COKEY_HOST;
  if (env.COKEY_DATA_DIR) next.dataDir = env.COKEY_DATA_DIR;
  if (env.COKEY_LOG_LEVEL && LOG_LEVELS.includes(env.COKEY_LOG_LEVEL as LogLevel)) {
    next.logLevel = env.COKEY_LOG_LEVEL as LogLevel;
  }
  if (env.COKEY_AUTH_TOKEN) next.authToken = env.COKEY_AUTH_TOKEN;
  if (env.COKEY_ALLOW_PRIVATE_ENDPOINTS === "1" || env.COKEY_ALLOW_PRIVATE_ENDPOINTS === "true") {
    next.allowPrivateEndpoints = true;
  }
  if (env.COKEY_FREE_PROVIDER_NUDGER === "0" || env.COKEY_FREE_PROVIDER_NUDGER === "false") {
    next.showFreeProviderNudger = false;
  }
  if (env.COKEY_MAX_RETRIES_PER_CREDENTIAL) {
    const retries = Number(env.COKEY_MAX_RETRIES_PER_CREDENTIAL);
    if (Number.isInteger(retries) && retries >= 0 && retries <= 10) {
      next.fallback.maxRetriesPerCredential = retries;
    }
  }

  return next;
}
