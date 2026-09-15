export class MiniYamlError extends Error {
  constructor(
    message: string,
    readonly line?: number,
  ) {
    super(line === undefined ? message : `${message} (line ${line})`);
    this.name = "MiniYamlError";
  }
}

interface SourceLine {
  indent: number;
  content: string;
  number: number;
}

export function parseMiniYaml(text: string): Record<string, unknown> {
  const lines = tokenize(text);
  if (lines.length === 0) return {};
  const [value, consumed] = parseBlock(lines, 0, lines[0]!.indent);
  if (consumed !== lines.length) {
    throw new MiniYamlError("Unexpected indentation", lines[consumed]?.number);
  }
  if (!isMapping(value)) throw new MiniYamlError("Top level must be a mapping");
  return value;
}

function tokenize(text: string): SourceLine[] {
  const out: SourceLine[] = [];
  const rawLines = text.replace(/\r\n?/g, "\n").split("\n");

  rawLines.forEach((raw, index) => {
    const withoutComment = stripComment(raw);
    if (withoutComment.trim() === "") return;
    if (withoutComment.includes("\t")) {
      throw new MiniYamlError("Tabs are not allowed for indentation", index + 1);
    }
    const indent = withoutComment.length - withoutComment.trimStart().length;
    out.push({ indent, content: withoutComment.trim(), number: index + 1 });
  });

  return out;
}

function stripComment(line: string): string {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("#")) return "";
  return line;
}

function parseBlock(lines: SourceLine[], start: number, indent: number): [unknown, number] {
  const first = lines[start];
  if (!first) throw new MiniYamlError("Unexpected end of file");
  if (first.content.startsWith("- ") || first.content === "-") {
    return parseSequence(lines, start, indent);
  }
  return parseMapping(lines, start, indent);
}

function parseMapping(
  lines: SourceLine[],
  start: number,
  indent: number,
): [Record<string, unknown>, number] {
  const result: Record<string, unknown> = {};
  let index = start;

  while (index < lines.length) {
    const line = lines[index]!;
    if (line.indent < indent) break;
    if (line.indent > indent) throw new MiniYamlError("Unexpected indentation", line.number);
    if (line.content.startsWith("- ")) break;

    const separator = findKeySeparator(line.content);
    if (separator === -1) throw new MiniYamlError("Expected `key: value`", line.number);

    const key = line.content.slice(0, separator).trim();
    const rest = line.content.slice(separator + 1).trim();
    if (!key) throw new MiniYamlError("Empty key", line.number);

    if (rest === "") {
      const next = lines[index + 1];
      if (next && next.indent > line.indent) {
        const [value, consumed] = parseBlock(lines, index + 1, next.indent);
        result[key] = value;
        index = consumed;
        continue;
      }
      result[key] = null;
      index += 1;
      continue;
    }

    result[key] = parseScalar(rest);
    index += 1;
  }

  return [result, index];
}

function parseSequence(lines: SourceLine[], start: number, indent: number): [unknown[], number] {
  const result: unknown[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index]!;
    if (line.indent < indent) break;
    if (line.indent > indent) throw new MiniYamlError("Unexpected indentation", line.number);
    if (!line.content.startsWith("- ") && line.content !== "-") break;

    const rest = line.content === "-" ? "" : line.content.slice(2).trim();

    if (rest === "") {
      const next = lines[index + 1];
      if (!next || next.indent <= line.indent) {
        result.push(null);
        index += 1;
        continue;
      }
      const [value, consumed] = parseBlock(lines, index + 1, next.indent);
      result.push(value);
      index = consumed;
      continue;
    }

    const separator = findKeySeparator(rest);
    if (separator === -1) {
      result.push(parseScalar(rest));
      index += 1;
      continue;
    }

    const itemIndent = line.indent + 2;
    const firstLine: SourceLine = {
      indent: itemIndent,
      content: rest,
      number: line.number,
    };
    const [value, consumed] = parseMapping([firstLine, ...lines.slice(index + 1)], 0, itemIndent);
    result.push(value);

    index += consumed;
  }

  return [result, index];
}

function findKeySeparator(content: string): number {
  const index = content.indexOf(":");
  if (index === -1) return -1;
  const after = content[index + 1];
  if (after === undefined || after === " ") return index;
  return -1;
}

function parseScalar(raw: string): unknown {
  const value = raw.trim();

  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (isFlowList(value)) return parseFlowList(value);
  return value;
}

function isFlowList(value: string): boolean {
  return value.startsWith("[") && value.endsWith("]");
}

function parseFlowList(value: string): unknown[] {
  const inner = value.slice(1, -1).trim();
  if (inner === "") return [];
  return inner.split(",").map((item) => parseScalar(item.trim()));
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
