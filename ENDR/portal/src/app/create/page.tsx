export const dynamic = "force-dynamic";
export const revalidate = 0;

import { PortalFrame } from "../components/portal-frame";
import { PageHeader } from "../components/ui/page-header";
import { loadSnapshot } from "../lib/platform";
import { CreateServicePanel } from "./service-create-panel";

export default async function CreatePage() {
  const snapshot = await loadSnapshot();

  return (
    <PortalFrame snapshot={snapshot}>
      <section className="portal-main create-main">
        <PageHeader
          title="Create Service"
          subtitle="Choose a template, namespace, and environment from platform.yaml — then open a PR that updates only services.yaml. The reconcile workflow generates everything else."
        />

        <CreateServicePanel />
      </section>
    </PortalFrame>
  );
}
