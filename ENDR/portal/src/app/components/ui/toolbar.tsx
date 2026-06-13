"use client";

import type { ReactNode } from "react";

export function Toolbar({
  query,
  onQuery,
  placeholder = "Search…",
  children,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="toolbar">
      <input
        className="toolbar-search"
        type="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={placeholder}
        aria-label="Search"
      />
      {children ? <div className="toolbar-filters">{children}</div> : null}
    </div>
  );
}
