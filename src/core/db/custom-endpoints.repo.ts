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

export class CustomEndpointsRepo {
  constructor(private readonly db: DatabaseClient) {}

  insert(input: InsertCustomEndpointInput): void {
    this.db
      .prepareCached(
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
    return this.db.prepareCached(`SELECT * FROM custom_endpoints WHERE id = ?`).get(id) as
      CustomEndpointRow | undefined;
  }

  list(): CustomEndpointRow[] {
    return this.db
      .prepareCached(`SELECT * FROM custom_endpoints ORDER BY created_at ASC`)
      .all() as CustomEndpointRow[];
  }

  delete(id: string): void {
    this.db.prepareCached(`DELETE FROM custom_endpoints WHERE id = ?`).run(id);
  }

  count(): number {
    const row = this.db.prepareCached(`SELECT COUNT(*) AS n FROM custom_endpoints`).get() as {
      n: number;
    };
    return row.n;
  }
}
