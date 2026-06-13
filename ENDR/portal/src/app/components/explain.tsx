"use client";

import type { ReactNode } from "react";

import { useNarrative } from "../lib/narrative";

// A narrative-aware "what's happening" callout — the explain boxes from the
// mockup. The page supplies both framings; the active one renders. IDP framing
// gets the blue accent, Interstellar the teal, matching the mockup.
export function Explain({ idp, interstellar }: { idp: ReactNode; interstellar: ReactNode }) {
  const { mode } = useNarrative();
  return (
    <aside className={`mc-explain${mode === "idp" ? " idp" : ""}`}>
      <span className="mc-explain-mark" aria-hidden="true">
        ℹ
      </span>
      <div className="mc-explain-body">{mode === "interstellar" ? interstellar : idp}</div>
    </aside>
  );
}
