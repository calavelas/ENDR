"use client";

import Link from "next/link";

import { useNarrative } from "../lib/narrative";
import * as Icon from "./icons";

// Narrative-aware "Create service" / "Create robot" button for server pages.
export function CreateButton({ large }: { large?: boolean }) {
  const { t } = useNarrative();
  return (
    <Link href="/create" className={`mc-btn${large ? " mc-btn-lg" : ""}`}>
      <Icon.Plus size={16} />
      {t.createCta}
    </Link>
  );
}
