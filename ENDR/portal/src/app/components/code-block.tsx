"use client";

import { highlight, languageFromFilename } from "../lib/prism";

// Read-only syntax-highlighted code block (Prism), language inferred from the
// filename. Used by the create-flow file viewer.
export function CodeBlock({ content, filename }: { content: string; filename: string }) {
  const html = highlight(content, languageFromFilename(filename));
  return (
    <pre className="file-viewer-content code-hl">
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}
