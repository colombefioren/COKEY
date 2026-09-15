export type ApiStyle = "openai" | "anthropic" | "google" | "cohere" | "cloudflare" | "ollama";

export type AuthScheme = "bearer" | "x-api-key" | "query-param" | "custom-header";

export interface FreeTierInfo {
  advertised: boolean;
  summary: string;
  quotaSource: "provider" | "unknown";

  freeModelsOnly?: boolean;
}

export interface VerificationSpec {
  method: "chat" | "models";

  model?: string;
}

export interface ProviderCatalogEntry {
  id: string;
  displayName: string;
  baseUrl: string;
  apiStyle: ApiStyle;
  authScheme: AuthScheme;

  signupUrl: string;
  docsUrl?: string;
  freeTier: FreeTierInfo;

  extraHeaders?: Record<string, string>;

  knownModels: string[];

  credentialFields: Array<"secret" | "accountId">;
  verification: VerificationSpec;

  notes?: string;
}

export interface ProviderStatus extends ProviderCatalogEntry {
  connected: boolean;
  credentialCount: number;
  healthyCount: number;
}
