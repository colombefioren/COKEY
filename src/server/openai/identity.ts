import type { RouteResult } from "../../core/router/engine.js";

/**
 * Client-facing identity for the gateway.
 *
 * A client should never have to learn about nine upstream vendors to use COKEY.
 * Everything a client sees is branded COKEY, and the chain alias is the model
 * name, because the alias is the only identifier COKEY actually owns:
 *
 *   - `owned_by` is always COKEY, so a picker lists one provider, not fifteen;
 *   - the response `model` is the alias the user asked for, so a chat window
 *     shows their own chain name instead of whichever upstream answered;
 *   - the real upstream is still reported in `X-Cokey-Entry` for anyone who
 *     wants to know, which is the honest place for it.
 *
 * None of this hides information. It moves the vendor detail out of the field
 * the UI renders and into a header that tools can read.
 */
export const COKEY_PROVIDER_NAME = "COKEY";

/** Rewrite the `model` field of an OpenAI-shaped body to the chain alias. */
export function withCokeyIdentity(body: unknown, chainAlias: string): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const record = body as Record<string, unknown>;
  if (typeof record.model !== "string") return body;
  return { ...record, model: chainAlias };
}

/**
 * One line describing what the router did, suitable for a client notification.
 *
 * This is the "chain changed state" message: not an error, just the gateway
 * narrating that the node or the key underneath the client moved.
 */
export function chainStateMessage(result: RouteResult): string {
  const entry = `${result.providerId}/${result.entryModel}`;
  if (!result.fallback) {
    return `chain changed state: ${result.chainAlias} served by ${entry} (${result.credentialDescription})`;
  }
  const reason = result.fallbackReason ?? "fallback";
  return `chain changed state: ${result.chainAlias} now on ${entry} via ${result.credentialDescription} (${reason})`;
}

/** Headers that make the current routing state machine-readable. */
export function identityHeaders(result: RouteResult): Record<string, string> {
  return {
    "x-cokey-provider": COKEY_PROVIDER_NAME,
    "x-cokey-chain": result.chainAlias,
    "x-cokey-entry": `${result.providerId}/${result.entryModel}`,
    "x-cokey-model": result.entryModel,
    "x-cokey-credential": result.credentialDescription,
    "x-cokey-fallback": String(result.fallback),
    // Clients that surface headers (most CLIs do) get the state change here.
    "x-cokey-state": chainStateMessage(result),
    ...(result.fallbackReason ? { "x-cokey-fallback-reason": result.fallbackReason } : {}),
  };
}
