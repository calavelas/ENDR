import { dataSourceTone, healthTone, syncTone, type NodeTone } from "../../lib/platform";

type Kind = "health" | "sync" | "source";

const toneFor: Record<Kind, (status: string) => NodeTone> = {
  health: healthTone,
  sync: syncTone,
  source: dataSourceTone,
};

// Status conveyed by icon + colour (icon added in globals.css via .status-pill::before).
export function StatusPill({ status, kind }: { status: string; kind: Kind }) {
  return <span className={`status-pill tone-${toneFor[kind](status)}`}>{status}</span>;
}
