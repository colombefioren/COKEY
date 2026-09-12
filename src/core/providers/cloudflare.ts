import type { ChainEntry, ChatCompletionRequest, Credential } from "../types.js";
import type { ProviderRequest } from "./adapter.js";
import { OpenAICompatibleAdapter } from "./openai-compatible.js";

/**
 * Cloudflare Workers AI.
 *
 * The wire format is OpenAI-compatible, but Cloudflare's schema is stricter:
 * unknown top-level parameters (OpenAI `reasoning`, `metadata`, `store`, etc.)
 * are rejected with a 400 "oneOf at '/' not matched" error. We strip everything
 * except the fields Cloudflare actually accepts.
 *
 * The account id is a path segment, so a credential without one cannot be used.
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

  /**
   * Whitelist the parameters Cloudflare Workers AI accepts.
   * Everything else (OpenAI `reasoning`, `metadata`, `store`, `user`, etc.)
   * is stripped to avoid a 400 schema-validation rejection.
   */
  private sanitizeBody(request: ChatCompletionRequest): Record<string, unknown> {
    const out: Record<string, unknown> = {
      messages: request.messages,
      stream: request.stream === true,
    };
    const src = request as Record<string, unknown>;
    const copyKeys = [
      "max_tokens",
      "max_new_tokens",
      "temperature",
      "top_p",
      "top_k",
      "repetition_penalty",
      "tools",
      "tool_choice",
      "response_format",
      "stream_options",
    ];
    for (const key of copyKeys) {
      if (src[key] !== undefined) {
        out[key] = src[key];
      }
    }
    // stream_options is invalid when stream is false — Cloudflare returns 400.
    if (!request.stream) {
      delete out.stream_options;
    }
    return out;
  }

  override createRequest(
    entry: ChainEntry,
    credential: Credential,
    request: ChatCompletionRequest,
  ): ProviderRequest {
    const base = this.resolveBaseUrl(entry, credential);
    const headers = this.chatHeaders(credential);
    const body = JSON.stringify({ ...this.sanitizeBody(request), model: entry.model });

    return {
      url: this.chatUrl(base.replace(/\/+$/, ""), credential),
      method: "POST",
      headers,
      body,
      stream: request.stream === true,
      proxyUrl: credential.proxyUrl,
    };
  }
}