export const dynamic = "force-dynamic";
export const revalidate = 0;

import { PortalFrame } from "../components/portal-frame";
import { loadSnapshot } from "../lib/plex";
import { CreateServicePanel } from "./service-create-panel";

export default async function CreatePage() {
  const snapshot = await loadSnapshot();

  return (
    <PortalFrame snapshot={snapshot}>
      <section className="portal-main create-main">
        <section className="hero-row create-hero">
          <div>
            <p className="eyebrow">Templates</p>
            <h1>Create Service</h1>
            <p className="hero-subtitle">Choose template, namespace, and Kubernetes environment from ENDR.yaml, then submit a PR that updates only SVCS.yaml.</p>
          </div>
        </section>

        <CreateServicePanel />
      </section>
    </PortalFrame>
  );
}
