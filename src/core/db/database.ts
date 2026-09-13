import Database from "better-sqlite3";

export type SqliteDatabase = Database.Database;

/**
 * An additive schema change. Migrations are applied in ascending version order
 * inside a single transaction each, and recorded in `schema_migrations`.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "core",
    sql: `
      CREATE TABLE IF NOT EXISTS credentials (
        id                   TEXT PRIMARY KEY,
        provider_id          TEXT NOT NULL,
        account_id           TEXT,
        secret_encrypted     TEXT NOT NULL,
        description          TEXT NOT NULL,
        status               TEXT NOT NULL,
        created_at           INTEGER NOT NULL,
        updated_at           INTEGER NOT NULL,
        last_verified_at     INTEGER,
        usage                TEXT NOT NULL,
        quota                TEXT,
        cooldown_until       INTEGER,
        consecutive_failures INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS chains (
        id          TEXT PRIMARY KEY,
        alias       TEXT UNIQUE NOT NULL,
        description TEXT,
        enabled     INTEGER NOT NULL DEFAULT 1,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chain_entries (
        id               TEXT PRIMARY KEY,
        chain_id         TEXT NOT NULL,
        provider_id      TEXT NOT NULL,
        model            TEXT NOT NULL,
        base_url         TEXT NOT NULL,
        credential_ids   TEXT NOT NULL,
        enabled          INTEGER NOT NULL DEFAULT 1,
        priority         INTEGER NOT NULL,
        routing_strategy TEXT NOT NULL DEFAULT 'sequential',
        created_at       INTEGER NOT NULL,
        updated_at       INTEGER NOT NULL,
        FOREIGN KEY (chain_id) REFERENCES chains(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_credentials_provider ON credentials(provider_id);
      CREATE INDEX IF NOT EXISTS idx_entries_chain ON chain_entries(chain_id, priority);
    `,
  },
  {
    version: 2,
    name: "request_log",
    sql: `
      CREATE TABLE IF NOT EXISTS request_log (
        id                   TEXT PRIMARY KEY,
        at                   INTEGER NOT NULL,
        chain_alias          TEXT NOT NULL,
        entry_id             TEXT NOT NULL,
        provider_id          TEXT NOT NULL,
        model                TEXT NOT NULL,
        credential_id        TEXT NOT NULL,
        credential_description TEXT NOT NULL,
        latency_ms           INTEGER NOT NULL,
        outcome              TEXT NOT NULL,
        classification       TEXT NOT NULL,
        fallback             INTEGER NOT NULL DEFAULT 0,
        fallback_reason      TEXT,
        attempts             INTEGER NOT NULL DEFAULT 1,
        stream               INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_request_log_at ON request_log(at DESC);
    `,
  },
  {
    version: 3,
    name: "custom_endpoints",
    sql: `
      CREATE TABLE IF NOT EXISTS custom_endpoints (
        id           TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        base_url     TEXT NOT NULL,
        api_style    TEXT NOT NULL DEFAULT 'openai',
        auth_scheme  TEXT NOT NULL DEFAULT 'bearer',
        models       TEXT NOT NULL DEFAULT '[]',
        created_at   INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL
      );
    `,
  },
  {
    version: 4,
    name: "credential_proxy",
    sql: `
      ALTER TABLE credentials ADD COLUMN proxy_url TEXT;
    `,
  },
  {
    version: 5,
    name: "usage_rollup",
    sql: `
      ALTER TABLE request_log ADD COLUMN input_tokens INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE request_log ADD COLUMN output_tokens INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS usage_daily (
        day             TEXT NOT NULL,
        provider_id     TEXT NOT NULL,
        credential_id   TEXT NOT NULL,
        model           TEXT NOT NULL,
        requests        INTEGER NOT NULL DEFAULT 0,
        success         INTEGER NOT NULL DEFAULT 0,
        failure         INTEGER NOT NULL DEFAULT 0,
        input_tokens    INTEGER NOT NULL DEFAULT 0,
        output_tokens   INTEGER NOT NULL DEFAULT 0,
        latency_ms_sum  INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, provider_id, credential_id, model)
      );

      CREATE INDEX IF NOT EXISTS idx_usage_daily_day ON usage_daily(day DESC);
    `,
  },
  {
    version: 6,
    name: "api_keys",
    sql: `
      CREATE TABLE IF NOT EXISTS api_keys (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        prefix       TEXT NOT NULL,
        key_hash     TEXT NOT NULL,
        created_at   INTEGER NOT NULL,
        last_used_at INTEGER,
        enabled      INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
    `,
  },
  {
    version: 7,
    name: "proxy_pool_and_entry_labels",
    sql: `
      -- The automatic egress pool. Entries are real proxy URLs; the gateway
      -- decides which credential leaves through which one.
      CREATE TABLE IF NOT EXISTS proxy_pool (
        id         TEXT PRIMARY KEY,
        url        TEXT NOT NULL UNIQUE,
        label      TEXT NOT NULL,
        enabled    INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );

      -- 1 when the proxy on this row was chosen by the pool rather than by the
      -- user. A manual proxy stays manual forever, even after a pool change.
      ALTER TABLE credentials ADD COLUMN proxy_auto INTEGER NOT NULL DEFAULT 0;

      -- User-chosen display name for a chain node, so a client can show
      -- "DeepSeek V4 Pro (xKiro)" instead of the raw upstream model id.
      ALTER TABLE chain_entries ADD COLUMN label TEXT;

      CREATE INDEX IF NOT EXISTS idx_credentials_proxy ON credentials(proxy_url);
    `,
  },
  {
    version: 8,
    name: "provider_model_inventory",
    sql: `
      -- What each provider actually returned the last time we asked.
      --
      -- The shipped catalog is curated by hand and is the right default, but it
      -- cannot know that a provider quietly retired a model this morning. This
      -- table is the observed truth: one row per (provider, model).
      --
      -- A model that stops being returned is marked unavailable rather than
      -- deleted, so it keeps its history, and a model that comes back can be
      -- reported as restored instead of appearing from nowhere. Rows are only
      -- dropped once they have been missing long enough to be considered gone
      -- for good (see ModelDiscovery.retainMissingMs).
      CREATE TABLE IF NOT EXISTS provider_models (
        provider_id  TEXT NOT NULL,
        model        TEXT NOT NULL,
        curated      INTEGER NOT NULL DEFAULT 0,
        available    INTEGER NOT NULL DEFAULT 1,
        first_seen   INTEGER NOT NULL,
        last_seen    INTEGER NOT NULL,
        last_checked INTEGER NOT NULL,
        PRIMARY KEY (provider_id, model)
      );

      CREATE INDEX IF NOT EXISTS idx_provider_models_available
        ON provider_models(provider_id, available);
    `,
  },
];

/**
 * Opens (and if necessary creates) the COKEY database.
 *
 * WAL mode keeps the CLI's short-lived readers from blocking the running
 * gateway, and foreign keys are enforced so deleting a chain cleans up entries.
 */
export class DatabaseClient {
  readonly db: SqliteDatabase;
  readonly path: string;

  constructor(path: string) {
    this.path = path;
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
    // Recover from a crashed writer: checkpoint any leftover WAL frames so
    // the main database file stays tidy and reads from an external connection
    // (e.g. `sqlite3 .cokey/cokey.db`) always see committed data.
    this.db.pragma("wal_checkpoint(TRUNCATE)");
    runMigrations(this.db);
  }

  /** Run a function inside a SQLite transaction. */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  appliedMigrations(): Array<{ version: number; name: string; applied_at: number }> {
    ensureMigrationTable(this.db);
    return this.db
      .prepare(`SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC`)
      .all() as Array<{ version: number; name: string; applied_at: number }>;
  }

  close(): void {
    if (this.db.open) this.db.close();
  }
}

function ensureMigrationTable(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);
}

export function runMigrations(db: SqliteDatabase, migrations: Migration[] = MIGRATIONS): number {
  ensureMigrationTable(db);
  const row = db.prepare(`SELECT MAX(version) AS v FROM schema_migrations`).get() as {
    v: number | null;
  };
  const current = row.v ?? 0;

  let applied = 0;
  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    if (migration.version <= current) continue;
    const apply = db.transaction(() => {
      db.exec(migration.sql);
      db.prepare(`INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)`).run(
        migration.version,
        migration.name,
        Date.now(),
      );
    });
    apply();
    applied += 1;
  }
  return applied;
}

// ---------------------------------------------------------------------------
// Row shapes. These mirror the columns exactly; repositories own the mapping
// to domain types so nothing else has to know about snake_case.
// ---------------------------------------------------------------------------

export interface CredentialRow {
  id: string;
  provider_id: string;
  account_id: string | null;
  secret_encrypted: string;
  proxy_url: string | null;
  proxy_auto: number;
  description: string;
  status: string;
  created_at: number;
  updated_at: number;
  last_verified_at: number | null;
  usage: string;
  quota: string | null;
  cooldown_until: number | null;
  consecutive_failures: number;
}

export interface ChainRow {
  id: string;
  alias: string;
  description: string | null;
  enabled: number;
  created_at: number;
  updated_at: number;
}

export interface ChainEntryRow {
  id: string;
  chain_id: string;
  provider_id: string;
  model: string;
  /** Optional user-chosen display name. Falls back to the model id. */
  label: string | null;
  base_url: string;
  credential_ids: string;
  enabled: number;
  priority: number;
  routing_strategy: string;
  created_at: number;
  updated_at: number;
}

export interface CustomEndpointRow {
  id: string;
  display_name: string;
  base_url: string;
  api_style: string;
  auth_scheme: string;
  models: string;
  created_at: number;
  updated_at: number;
}

export interface RequestLogRow {
  id: string;
  at: number;
  chain_alias: string;
  entry_id: string;
  provider_id: string;
  model: string;
  credential_id: string;
  credential_description: string;
  latency_ms: number;
  outcome: string;
  classification: string;
  fallback: number;
  fallback_reason: string | null;
  attempts: number;
  stream: number;
  input_tokens: number;
  output_tokens: number;
}

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  key_hash: string;
  created_at: number;
  last_used_at: number | null;
  enabled: number;
}

export interface ProviderModelRow {
  provider_id: string;
  model: string;
  /** 1 when the shipped catalog also lists this model. */
  curated: number;
  /** 1 when the provider returned it on the most recent check. */
  available: number;
  first_seen: number;
  last_seen: number;
  last_checked: number;
}
