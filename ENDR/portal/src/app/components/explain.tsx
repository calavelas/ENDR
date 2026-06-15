"use client";

import type { ReactNode } from "react";

import { useNarrative } from "../lib/narrative";

// A narrative-aware page hero card — describes what the page is. Renders as the
// standard `mc-detail-hero` card (see DOCS/UI_DESIGN_SYSTEM.md §0.5), matching
// the service-detail hero, instead of a thin info banner. The page supplies both
// framings; the active narrative one renders.
export function Explain({
  eyebrow = "Overview",
  idp,
  interstellar,
}: {
  eyebrow?: ReactNode;
  idp: ReactNode;
  interstellar: ReactNode;
}) {
  const { mode } = useNarrative();
  return (
    <section className="mc-panel mc-detail-hero">
      <span className="mc-detail-sub">{eyebrow}</span>
      <div className="mc-detail-hero-copy">{mode === "interstellar" ? interstellar : idp}</div>
    </section>
  );
}
