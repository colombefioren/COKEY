export interface ProxyListLine {
  raw: string;
  label: string;
  ok: boolean;
  error?: string;
}

export function validateProxyLine(raw: string): ProxyListLine {
  const trimmed = raw.trim();
  if (!trimmed)
    return { raw: trimmed, label: "", ok: false, error: "Empty line" };
  try {
    const parsed = parseProxyUrl(trimmed);
    if (!parsed)
      return { raw: trimmed, label: "", ok: false, error: "Invalid proxy address" };
    return { raw: trimmed, label: parsed.label, ok: true };
  } catch (error) {
    return { raw: trimmed, label: "", ok: false, error: String(error) };
  }
}

export function linesToUrls(lines: string[]): string[] {
  return lines
    .map((raw) => raw.trim())
    .filter(Boolean)
    .filter((raw) => {
      try {
        const parsed = parseProxyUrl(raw);
        return parsed !== undefined;
      } catch {
        return false;
      }
    });
}

import { parseProxyUrl } from "./proxy.js";
