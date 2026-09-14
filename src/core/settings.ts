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
const PASSWORD_KEY = "adminPassword";
const PASSWORD_LOCKED_KEY = "adminPasswordLocked";
export const DEFAULT_ADMIN_PASSWORD = "coco-the-best";

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

  /** The admin password. Defaults to `coco-the-best` until the user sets one. */
  password(): string {
    return this.repo.get(PASSWORD_KEY) ?? DEFAULT_ADMIN_PASSWORD;
  }

  /**
   * True once the user has chosen their own password. From that point the
   * password is permanent — there is no UI or API path to change it again.
   */
  passwordLocked(): boolean {
    return this.repo.get(PASSWORD_LOCKED_KEY) === "1";
  }

  verifyPassword(candidate: string): boolean {
    return candidate.length > 0 && candidate === this.password();
  }

  /**
   * Set the admin password. Only allowed while the default is still in place;
   * afterwards the stored password is immutable.
   */
  setPassword(password: string): void {
    if (this.passwordLocked()) {
      throw new InvalidSettingError(
        "The admin password has already been set and cannot be changed",
      );
    }
    if (!password || password.length < 4) {
      throw new InvalidSettingError("Password must be at least 4 characters");
    }
    this.repo.set(PASSWORD_KEY, password);
    this.repo.set(PASSWORD_LOCKED_KEY, "1");
    this.current = this.compute();
  }

  private compute(): Settings {
    const defaults = defaultSettings(this.env.COKEY_DATA_DIR || process.cwd() + "/.cokey");
    const stored = this.repo.getJson<Partial<Settings>>(SETTINGS_KEY) ?? {};

    const base = validateSettings({
      ...defaults,
      ...stored,
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

  if (
    settings.autoProxyStrategy !== "per-provider" &&
    settings.autoProxyStrategy !== "round-robin"
  ) {
    throw new InvalidSettingError(`Invalid auto proxy strategy: ${settings.autoProxyStrategy}`);
  }

  const freeProviderTarget = Number(settings.freeProviderTarget);
  if (!Number.isInteger(freeProviderTarget) || freeProviderTarget < 0 || freeProviderTarget > 50) {
    throw new InvalidSettingError(`Invalid free provider target: ${settings.freeProviderTarget}`);
  }

  const policy = settings.fallback ?? DEFAULT_FALLBACK_POLICY;
  const maxRetriesPerCredential = Number(policy.maxRetriesPerCredential);
  if (
    !Number.isInteger(maxRetriesPerCredential) ||
    maxRetriesPerCredential < 0 ||
    maxRetriesPerCredential > 10
  ) {
    throw new InvalidSettingError(
      `Invalid max retries per credential: ${policy.maxRetriesPerCredential}`,
    );
  }

  return {
    ...settings,
    port,
    autoProxy: Boolean(settings.autoProxy),
    freeProviderTarget,
    fallback: { ...policy, maxRetriesPerCredential },
  };
}

/** Environment overrides, applied last so they always win. */
export function applyEnvOverrides(settings: Settings, env: NodeJS.ProcessEnv): Settings {
  const next: Settings = { ...settings, fallback: { ...settings.fallback } };

  // `PORT` is the convention most hosting platforms (Render, Heroku, Fly, …)
  // inject to say which port a web service must listen on — it is assigned by
  // the platform, not chosen by whoever deploys, so COKEY has to read it on
  // its own rather than expect a `COKEY_PORT` someone remembered to set to
  // match. The COKEY-prefixed variable still wins when both are present, for
  // a setup that deliberately pins its own port.
  const portOverride = env.COKEY_PORT ?? env.PORT;
  if (portOverride) {
    const port = Number(portOverride);
    if (Number.isInteger(port) && port >= 0 && port <= 65535) next.port = port;
  }
  if (env.COKEY_HOST) next.host = env.COKEY_HOST;
  if (env.COKEY_DATA_DIR) next.dataDir = env.COKEY_DATA_DIR;
  if (env.COKEY_LOG_LEVEL && LOG_LEVELS.includes(env.COKEY_LOG_LEVEL as LogLevel)) {
    next.logLevel = env.COKEY_LOG_LEVEL as LogLevel;
  }
  if (env.COKEY_ALLOW_PRIVATE_ENDPOINTS === "1" || env.COKEY_ALLOW_PRIVATE_ENDPOINTS === "true") {
    next.allowPrivateEndpoints = true;
  }
  if (env.COKEY_FREE_PROVIDER_NUDGER === "0" || env.COKEY_FREE_PROVIDER_NUDGER === "false") {
    next.showFreeProviderNudger = false;
  }
  if (env.COKEY_AUTO_PROXY === "0" || env.COKEY_AUTO_PROXY === "false") {
    next.autoProxy = false;
  }
  if (env.COKEY_AUTO_PROXY === "1" || env.COKEY_AUTO_PROXY === "true") {
    next.autoProxy = true;
  }
  if (
    env.COKEY_AUTO_PROXY_STRATEGY === "round-robin" ||
    env.COKEY_AUTO_PROXY_STRATEGY === "per-provider"
  ) {
    next.autoProxyStrategy = env.COKEY_AUTO_PROXY_STRATEGY;
  }
  if (env.COKEY_MAX_RETRIES_PER_CREDENTIAL) {
    const retries = Number(env.COKEY_MAX_RETRIES_PER_CREDENTIAL);
    if (Number.isInteger(retries) && retries >= 0 && retries <= 10) {
      next.fallback.maxRetriesPerCredential = retries;
    }
  }

  return next;
}
