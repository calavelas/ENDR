export const dynamic = "force-dynamic";
export const revalidate = 0;

import { LinkButton } from "../components/ui/button";
import { PageHeader } from "../components/ui/page-header";
import { HistoryPanel } from "./history-panel";

export default function HistoryPage() {
  return (
    <>
      <section className="portal-main">
        <PageHeader
          title="History"
          subtitle="Pull requests opened by the portal (title format “portal - Adding service :”)."
          actions={<LinkButton href="/create">Create service</LinkButton>}
        />

        <HistoryPanel />
      </section>
    </>
  );
}
