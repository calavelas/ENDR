export const dynamic = "force-dynamic";
export const revalidate = 0;

import { PageHeader } from "../components/ui/page-header";
import { CreateServicePanel } from "./service-create-panel";

export default function CreatePage() {
  return (
    <>
      <section className="portal-main create-main">
        <PageHeader
          title="Create Service"
          subtitle="Choose a template, namespace, and environment from platform.yaml — then open a PR that updates only services.yaml. The reconcile workflow generates everything else."
        />

        <CreateServicePanel />
      </section>
    </>
  );
}
