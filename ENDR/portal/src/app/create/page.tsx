export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Explain } from "../components/explain";
import { CreateServicePanel } from "./service-create-panel";

export default function CreatePage() {
  return (
    <div className="mc create-main">
      <Explain
        idp={
          <>
            <p>
              A guided flow — <b>basics → tech stack → configuration → review</b>. Every step edits one
              entry in <code>services.yaml</code>, the platform's <b>desired-state catalog</b>. On{" "}
              <b>Create</b>, ENDR opens a <b>pull request</b> adding that entry; the reconcile workflow
              generates the app scaffold, Helm chart and ArgoCD app, and ArgoCD deploys the merge. No
              kubectl.
            </p>
            <p>
              <b>Day-0 bootstrap only.</b> This seeds <code>services.yaml</code> — <em>what should
              exist</em>, not the running config. After creation the service is configured through its
              own generated GitOps chart (<em>how it actually runs</em>); the catalog only tracks desired
              state.
            </p>
          </>
        }
        interstellar={
          <>
            <p>
              A guided flow — <b>basics → chassis → calibration → review</b>. Every step edits one entry
              in <code>services.yaml</code>, the <b>desired-state catalog</b>. On <b>Create</b>, ENDR opens
              a <b>pull request</b> adding that entry; the reconcile workflow forges the scaffold, Helm
              chart and ArgoCD app, and the autopilot deploys the merge. No kubectl.
            </p>
            <p>
              <b>Day-0 bootstrap only.</b> This seeds <code>services.yaml</code> — <em>what should
              exist</em>, not the running config. After launch the robot is configured through its own
              generated GitOps chart (<em>how it actually runs</em>); the catalog only tracks desired
              state.
            </p>
          </>
        }
      />

      <CreateServicePanel />
    </div>
  );
}
