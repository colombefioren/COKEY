import type { ChainEntry, Credential } from "../types.js";
import { OpenAICompatibleAdapter } from "./openai-compatible.js";

/**
 * Cloudflare Workers AI.
 *
 * The wire format is OpenAI-compatible; the only difference is that the account
 * id is a path segment, so a credential without one cannot be used at all.
 */
export class CloudflareAdapter extends OpenAICompatibleAdapter {
  override resolveBaseUrl(entry: ChainEntry, credential: Credential): string {
    if (!credential.accountId) {
      throw new Error("Cloudflare credentials require an account id");
    }
    return entry.baseUrl
      .replace(/\{account_id\}/g, encodeURIComponent(credential.accountId))
      .replace(/\/+$/, "");
  }

  override buildHeaders(credential: Credential): Record<string, string> {
    // Cloudflare expects a bearer token, but rejects a missing account id early
    // so the error is attributable to the user rather than the upstream.
    if (!credential.accountId) {
      throw new Error("Cloudflare credentials require an account id");
    }
    return super.buildHeaders(credential);
  }

  protected override modelsUrl(credential: Credential): string {
    if (!credential.accountId) {
      throw new Error("Cloudflare credentials require an account id");
    }
    const base = this.catalog.baseUrl
      .replace(/\{account_id\}/g, encodeURIComponent(credential.accountId))
      .replace(/\/+$/, "");
    return `${base}/models`;
  }
}
