import type { ReactNode } from "react";

/**
 * A small Markdown renderer for content-repository prose.
 *
 * The terms and dossier bodies are written in the content repository, so they
 * arrive as Markdown rather than as React nodes. This covers the subset the
 * content actually uses — paragraphs, `##` headings, `-` lists, bold, italic,
 * inline code and links — and nothing else.
 *
 * It deliberately does not support raw HTML. Rendering untrusted markup from a
 * file on disk into the dashboard is how a content edit becomes a script
 * injection, and no dossier needs it.
 */

/** Split on the inline constructs that need wrapping, keeping the separators. */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter((part) => part !== "")
    .map((part, index) => {
      const key = `${keyPrefix}-${index}`;

      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return <code key={key}>{part.slice(1, -1)}</code>;
      }
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
      if (link) {
        return (
          <a key={key} href={link[2]} target="_blank" rel="noreferrer noopener">
            {link[1]}
          </a>
        );
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return <em key={key}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    const joined = paragraph.join(" ");
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(joined, `p${blocks.length}`)}</p>);
    paragraph = [];
  };

  const flushBullets = (): void => {
    if (bullets.length === 0) return;
    const items = bullets;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {items.map((item, index) => (
          <li key={index}>{renderInline(item, `ul${blocks.length}-${index}`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();

    if (line === "") {
      flushBullets();
      flushParagraph();
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraph();
      bullets.push(line.slice(2));
      continue;
    }

    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushBullets();
      flushParagraph();
      blocks.push(
        <h4 key={`h-${blocks.length}`}>{renderInline(heading[2]!, `h${blocks.length}`)}</h4>,
      );
      continue;
    }

    if (line.startsWith("> ")) {
      flushBullets();
      flushParagraph();
      blocks.push(
        <blockquote key={`b-${blocks.length}`}>
          {renderInline(line.slice(2), `b${blocks.length}`)}
        </blockquote>,
      );
      continue;
    }

    flushBullets();
    paragraph.push(line);
  }

  flushBullets();
  flushParagraph();

  return <>{blocks}</>;
}
