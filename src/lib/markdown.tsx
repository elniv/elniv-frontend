import { Fragment } from "react";
import type { ReactNode } from "react";

// A small, safe Markdown renderer for assistant replies. It builds React elements
// (never raw HTML) and only allows http(s) links.

export type Inline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "link"; href: string; c: Inline[] };

export type Block =
  | { t: "p"; c: Inline[] }
  | { t: "h"; c: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; items: Inline[][] }
  | { t: "quote"; c: Inline[] }
  | { t: "code"; v: string; lang: string };

const TOKEN = /`([^`\n]+)`|\*\*([^*\n]+?)\*\*|(?<![\w*])\*([^*\s][^*\n]*?)\*(?![\w*])|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ t: "text", v: text.slice(last, index) });
    if (match[1] !== undefined) out.push({ t: "code", v: match[1] });
    else if (match[2] !== undefined) out.push({ t: "strong", c: parseInline(match[2]) });
    else if (match[3] !== undefined) out.push({ t: "em", c: parseInline(match[3]) });
    else if (match[4] !== undefined && match[5] !== undefined) out.push({ t: "link", href: match[5], c: parseInline(match[4]) });
    last = index + match[0].length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

const HEADING = /^#{1,6}\s+(.*)$/;
const UL = /^\s*[-*•]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const FENCE = /^```\s*([\w-]*)\s*$/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    const fence = line.match(FENCE);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? "")) body.push(lines[i++] ?? "");
      i++; // closing fence (or end of text for an unterminated block)
      blocks.push({ t: "code", v: body.join("\n"), lang: fence[1] ?? "" });
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({ t: "h", c: parseInline(heading[1] ?? "") });
      i++;
      continue;
    }

    if (UL.test(line) || OL.test(line)) {
      const ordered = OL.test(line);
      const pattern = ordered ? OL : UL;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = (lines[i] ?? "").match(pattern);
        if (!m) break;
        items.push(parseInline(m[1] ?? ""));
        i++;
      }
      blocks.push({ t: ordered ? "ol" : "ul", items });
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length) {
        const m = (lines[i] ?? "").match(QUOTE);
        if (!m) break;
        body.push(m[1] ?? "");
        i++;
      }
      blocks.push({ t: "quote", c: parseInline(body.join("\n")) });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length) {
      const current = lines[i] ?? "";
      if (!current.trim() || FENCE.test(current) || HEADING.test(current) || UL.test(current) || OL.test(current) || QUOTE.test(current)) break;
      para.push(current);
      i++;
    }
    blocks.push({ t: "p", c: parseInline(para.join("\n")) });
  }
  return blocks;
}

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((node, index) => {
    switch (node.t) {
      case "text":
        return (
          <Fragment key={index}>
            {node.v.split("\n").map((part, partIndex) => (
              <Fragment key={partIndex}>
                {partIndex > 0 && <br />}
                {part}
              </Fragment>
            ))}
          </Fragment>
        );
      case "code":
        return <code key={index}>{node.v}</code>;
      case "strong":
        return <strong key={index}>{renderInline(node.c)}</strong>;
      case "em":
        return <em key={index}>{renderInline(node.c)}</em>;
      case "link":
        return (
          <a key={index} href={node.href} target="_blank" rel="noopener noreferrer">
            {renderInline(node.c)}
          </a>
        );
    }
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  return (
    <div className="prose">
      {blocks.map((block, index) => {
        switch (block.t) {
          case "p":
            return <p key={index}>{renderInline(block.c)}</p>;
          case "h":
            return <h4 key={index}>{renderInline(block.c)}</h4>;
          case "quote":
            return <blockquote key={index}>{renderInline(block.c)}</blockquote>;
          case "ul":
            return (
              <ul key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </ol>
            );
          case "code":
            return (
              <pre key={index}>
                <code>{block.v}</code>
              </pre>
            );
        }
      })}
    </div>
  );
}
