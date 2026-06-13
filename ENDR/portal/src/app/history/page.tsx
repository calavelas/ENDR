export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { PortalFrame } from "../components/portal-frame";
import { loadSnapshot } from "../lib/platform";
import { HistoryPanel } from "./history-panel";

export default async function HistoryPage() {
  const snapshot = await loadSnapshot();

  return (
    <PortalFrame snapshot={snapshot}>
      <section className="portal-main">
        <section className="hero-row">
          <div>
            <p className="eyebrow">Audit</p>
            <h1>History</h1>
            <p className="hero-subtitle">
              Tracks pull requests created by the portal using the title format <code>portal - Adding service :</code>.
            </p>
          </div>
          <Link className="open-link" href="/create">
            Create Service
          </Link>
        </section>

        <HistoryPanel />
      </section>
    </PortalFrame>
  );
}
