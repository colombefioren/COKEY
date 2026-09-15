const useColor =
  Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && process.env.TERM !== "dumb";

function wrap(code: number): (value: string) => string {
  return (value) => (useColor ? `\x1b[${code}m${value}\x1b[0m` : value);
}

export const bold = wrap(1);
export const dim = wrap(2);
export const red = wrap(31);
export const green = wrap(32);
export const yellow = wrap(33);
export const blue = wrap(34);
export const cyan = wrap(36);
export const magenta = wrap(35);
export const brightMagenta = wrap(95);

export function statusGlyph(status: string): string {
  switch (status) {
    case "healthy":
      return green("●");
    case "cooldown":
      return yellow("●");
    case "invalid":
      return red("●");
    case "disabled":
      return dim("○");
    default:
      return dim("◌");
  }
}

export function table(headers: string[], rows: string[][]): string {
  const all = [headers, ...rows];
  const widths = headers.map((_, column) =>
    Math.max(...all.map((row) => visibleLength(row[column] ?? ""))),
  );

  const lines = [headers.map((header, i) => bold(header.padEnd(widths[i]!))).join("  ")];
  for (const row of rows) {
    lines.push(
      row
        .map(
          (cell, i) =>
            (cell ?? "") + " ".repeat(Math.max(0, widths[i]! - visibleLength(cell ?? ""))),
        )
        .join("  ")
        .trimEnd(),
    );
  }
  return lines.join("\n");
}

function visibleLength(value: string): number {
  // eslint-disable-next-line no-control-regex
  return value.replace(/\x1b\[[0-9;]*m/g, "").length;
}

export function humanizeDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "-";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)}h`;
  return `${(ms / 86_400_000).toFixed(1)}d`;
}

export function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour12: false });
}

export function shortId(id: string, length = 8): string {
  return id.length <= length ? id : id.slice(0, length);
}

export function bullet(ok: boolean): string {
  return ok ? green("✓") : red("✗");
}
