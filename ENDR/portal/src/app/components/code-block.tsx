"use client";

import { highlight, languageFromFilename } from "../lib/prism";

export interface DiffOptions {
  // When set, only the matching `- name: <entryName>` list block is treated as an
  // addition (used for services.yaml, where just one entry is appended). When
  // omitted, every line is treated as an addition (a brand-new generated file).
  entryName?: string;
  // Substrings of the user's own choices — lines containing one are highlighted
  // as "your change".
  highlights?: string[];
}

interface DiffLine {
  text: string;
  added: boolean;
  user: boolean;
}

const TOP_LEVEL_ENTRY = /^- name:\s*(.+?)\s*$/;

function computeDiff(content: string, opts: DiffOptions): DiffLine[] {
  const lines = content.replace(/\n+$/, "").split("\n");
  const highlights = (opts.highlights ?? []).filter((value) => value && value.trim().length >= 2);

  // Decide which lines count as additions.
  const added = new Array(lines.length).fill(!opts.entryName);
  if (opts.entryName) {
    let start = -1;
    let end = lines.length;
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(TOP_LEVEL_ENTRY);
      if (!match) continue;
      if (match[1].trim() === opts.entryName.trim()) {
        start = i;
      } else if (start >= 0) {
        end = i;
        break;
      }
    }
    for (let i = start; i >= 0 && i < end; i += 1) added[i] = true;
  }

  return lines.map((text, i) => ({
    text,
    added: added[i],
    user: added[i] && highlights.some((value) => text.includes(value)),
  }));
}

interface CodeBlockProps {
  content: string;
  filename: string;
  diff?: DiffOptions;
}

// Read-only syntax-highlighted code block (Prism), language inferred from the
// filename. With `diff`, it renders git-style: added lines get a `+` gutter +
// green tint, and the user's own changes are highlighted.
export function CodeBlock({ content, filename, diff }: CodeBlockProps) {
  const language = languageFromFilename(filename);

  if (!diff) {
    const html = highlight(content, language);
    return (
      <pre className="file-viewer-content code-hl">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    );
  }

  const lines = computeDiff(content, diff);
  return (
    <pre className="file-viewer-content code-hl code-diff">
      <code>
        {lines.map((line, i) => (
          <span
            key={i}
            className={`diff-line${line.added ? " add" : ""}${line.user ? " user" : ""}`}
          >
            <span className="diff-gutter" aria-hidden="true">
              {line.added ? "+" : " "}
            </span>
            <span
              className="diff-code"
              dangerouslySetInnerHTML={{ __html: highlight(line.text || " ", language) }}
            />
          </span>
        ))}
      </code>
    </pre>
  );
}
