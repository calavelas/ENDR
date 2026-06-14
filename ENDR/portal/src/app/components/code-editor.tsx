"use client";

import { useRef, type KeyboardEvent } from "react";

import { highlight } from "../lib/prism";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  language?: string;
  ariaLabel?: string;
}

// Lightweight syntax-highlighted editor: a transparent <textarea> overlaid on a
// Prism-highlighted <pre>. No external editor dependency, React 19-safe. The
// <pre> sits in flow and defines the height; the textarea fills it.
export function CodeEditor({ value, onChange, onBlur, language = "yaml", ariaLabel }: CodeEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const html = highlight(value, language);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const ta = event.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      onChange(`${value.slice(0, start)}  ${value.slice(end)}`);
      requestAnimationFrame(() => {
        if (taRef.current) {
          taRef.current.selectionStart = taRef.current.selectionEnd = start + 2;
        }
      });
    }
  };

  return (
    <div className="code-edit">
      <pre className="code-edit-pre code-hl" aria-hidden="true">
        <code dangerouslySetInnerHTML={{ __html: `${html}\n` }} />
      </pre>
      <textarea
        ref={taRef}
        className="code-edit-ta"
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        aria-label={ariaLabel}
      />
    </div>
  );
}
