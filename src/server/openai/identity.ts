import type { AttemptLog, RouteResult } from "../../core/router/engine.js";

export const COKEY_PROVIDER_NAME = "COKEY";

export function withCokeyIdentity(body: unknown, chainAlias: string): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const record = body as Record<string, unknown>;
  if (typeof record.model !== "string") return body;
  return { ...record, model: chainAlias };
}

export function chainStateMessage(result: RouteResult): string {
  const entry = `${result.providerId}/${result.entryModel}`;
  if (!result.fallback) {
    return `chain changed state: ${result.chainAlias} served by ${entry} (${result.credentialDescription})`;
  }
  const reason = result.fallbackReason ?? "fallback";
  return `chain changed state: ${result.chainAlias} now on ${entry} via ${result.credentialDescription} (${reason})`;
}

export function chainStateNotice(result: RouteResult): string | null {
  if (!result.fallback) return null;
  return `\n[chain state] ${chainStateMessage(result)}\n\n`;
}

export function withChainStateNotice(body: unknown, notice: string | null): unknown {
  if (!notice || !body || typeof body !== "object" || Array.isArray(body)) return body;
  const record = body as Record<string, unknown>;
  const choices = record.choices;
  if (!Array.isArray(choices)) return body;
  const changed = choices.map((choice) => {
    const content = (choice as Record<string, unknown> | undefined)?.message as
      Record<string, unknown> | undefined;
    if (!content || typeof content.content !== "string") return choice;
    return {
      ...(choice as Record<string, unknown>),
      message: { ...content, content: `${notice}${content.content}` },
    };
  });
  return { ...record, choices: changed };
}

export function identityHeaders(result: RouteResult): Record<string, string> {
  return {
    "x-cokey-provider": COKEY_PROVIDER_NAME,
    "x-cokey-chain": result.chainAlias,
    "x-cokey-entry": `${result.providerId}/${result.entryModel}`,
    "x-cokey-model": result.entryModel,
    "x-cokey-credential": result.credentialDescription,
    "x-cokey-fallback": String(result.fallback),

    "x-cokey-state": chainStateMessage(result),
    ...(result.fallbackReason ? { "x-cokey-fallback-reason": result.fallbackReason } : {}),
  };
}

export function errorIdentityHeaders(info: {
  attempts: AttemptLog[];
  chainAlias?: string;
  fallback?: boolean;
  fallbackReason?: string;
}): Record<string, string> {
  const attempts = info.attempts;
  const last = attempts[attempts.length - 1];
  const origin = attempts.length > 0 ? "provider" : "gateway";
  const headers: Record<string, string> = {
    "x-cokey-error-origin": origin,
    "x-cokey-state": errorStateMessage(info),
    "x-cokey-attempts": String(attempts.length),
  };
  if (info.chainAlias) headers["x-cokey-chain"] = info.chainAlias;
  if (info.fallback) headers["x-cokey-fallback"] = "true";
  if (info.fallbackReason) headers["x-cokey-fallback-reason"] = info.fallbackReason;
  if (last) {
    headers["x-cokey-provider"] = last.providerId;
    headers["x-cokey-entry"] = `${last.providerId}/${last.model}`;
    headers["x-cokey-model"] = last.model;
    headers["x-cokey-credential"] = last.description;
    if (last.status !== undefined) headers["x-cokey-upstream-status"] = String(last.status);
  }
  return headers;
}

export function errorStateMessage(info: {
  attempts: AttemptLog[];
  chainAlias?: string;
  fallback?: boolean;
  fallbackReason?: string;
}): string {
  const { attempts, chainAlias, fallback, fallbackReason } = info;
  const who = chainAlias ?? "chain";
  if (attempts.length === 0) return `chain state: ${who} could not be routed`;
  const providers = [...new Set(attempts.map((a) => a.providerId))].join(", ");
  if (fallback) {
    return `chain state: ${who} fell back across ${attempts.length} node(s) via ${providers} and failed (${fallbackReason ?? "exhausted"})`;
  }
  return `chain state: ${who} ${providers} did not answer OK`;
}
