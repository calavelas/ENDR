import { ReactNode } from "react";

import { dataSourceTone, formatTimestamp, PlatformSnapshot } from "../lib/platform";
import { AutoRefresh } from "./auto-refresh";
import { TopNav } from "./ui/top-nav";

interface PortalFrameProps {
  children: ReactNode;
  snapshot: PlatformSnapshot;
}

export function PortalFrame({ children, snapshot }: PortalFrameProps) {
  return (
    <main className="portal-shell">
      <AutoRefresh />

      <header className="portal-topbar">
        <div className="topbar-brand">
          <span className="brand-dot" />
          <strong>ENDR</strong>
          <span className="topbar-purpose">IDP</span>
        </div>

        <TopNav />

        <div className="topbar-status">
          <span className={`chip tone-${dataSourceTone(snapshot.dataSource)}`}>{snapshot.dataSource}</span>
          <span className="chip muted">Updated {formatTimestamp(snapshot.generatedAt)}</span>
        </div>
      </header>

      {children}
    </main>
  );
}
