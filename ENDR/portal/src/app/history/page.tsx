export const dynamic = "force-dynamic";
export const revalidate = 0;

import { PortalFrame } from "../components/portal-frame";
import { LinkButton } from "../components/ui/button";
import { PageHeader } from "../components/ui/page-header";
import { loadSnapshot } from "../lib/platform";
import { HistoryPanel } from "./history-panel";

export default async function HistoryPage() {
  const snapshot = await loadSnapshot();

  return (
    <PortalFrame snapshot={snapshot}>
      <section className="portal-main">
        <PageHeader
          title="History"
          subtitle="Pull requests opened by the portal (title format “portal - Adding service :”)."
          actions={<LinkButton href="/create">Create service</LinkButton>}
        />

        <HistoryPanel />
      </section>
    </PortalFrame>
  );
}
