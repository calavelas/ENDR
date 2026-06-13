import type { ReactNode } from "react";

import type { NodeTone } from "../../lib/platform";

export function StatCard({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: NodeTone;
  hint?: string;
}) {
  return (
    <div className={`stat-card stat-tone-${tone}`}>
      <span className="stat-card-value">{value}</span>
      <span className="stat-card-label">{label}</span>
      {hint ? <span className="stat-card-hint">{hint}</span> : null}
    </div>
  );
}
