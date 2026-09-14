import type { CustomEndpointRow, DatabaseClient } from "./database.js";

export interface InsertCustomEndpointInput {
  id: string;
  displayName: string;
  baseUrl: string;
  apiStyle: string;
  authScheme: string;
  models: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Storage for the deliberately buried "custom OpenAI-compatible endpoint"
 * option. These rows are merged into the provider catalog at runtime, after
 * passing the SSRF guard.
 */
export class CustomEndpointsRepo {
  constructor(private readonly db: DatabaseClient) {}

  insert(input: InsertCustomEndpointInput): void {
    this.db.db
      .prepare(
        `INSERT INTO custom_endpoints
           (id, display_name, base_url, api_style, auth_scheme, models, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.displayName,
        input.baseUrl,
        input.apiStyle,
        input.authScheme,
        input.models,
        input.createdAt,
        input.updatedAt,
      );
  }

  get(id: string): CustomEndpointRow | undefined {
    return this.db.db.prepare(`SELECT * FROM custom_endpoints WHERE id = ?`).get(id) as
      CustomEndpointRow | undefined;
  }

  list(): CustomEndpointRow[] {
    return this.db.db
      .prepare(`SELECT * FROM custom_endpoints ORDER BY created_at ASC`)
      .all() as CustomEndpointRow[];
  }

  delete(id: string): void {
    this.db.db.prepare(`DELETE FROM custom_endpoints WHERE id = ?`).run(id);
  }

  count(): number {
    const row = this.db.db.prepare(`SELECT COUNT(*) AS n FROM custom_endpoints`).get() as {
      n: number;
    };
    return row.n;
  }
}
