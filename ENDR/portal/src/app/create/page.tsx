export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Explain } from "../components/explain";
import { StageRail } from "../components/stage-rail";
import { CreateServicePanel } from "./service-create-panel";

export default function CreatePage() {
  return (
    <div className="mc create-main">
      <StageRail active="declare" />

      <Explain
        idp={
          <>
            Three steps — <b>basics → tech stack → configuration</b>. You're appending one entry to{" "}
            <code>services.yaml</code>, the platform's <b>desired-state catalog</b>. From it, ENDR
            generates the app scaffold, Helm chart and ArgoCD app, opens a <b>pull request</b>, and
            ArgoCD deploys the merge. No kubectl.
          </>
        }
        interstellar={
          <>
            Three steps — <b>basics → chassis → calibration</b>. You're filing one entry in{" "}
            <code>services.yaml</code>, the <b>desired-state catalog</b>. From it, ENDR forges the
            scaffold, Helm chart and ArgoCD app, opens a <b>pull request</b>, and the autopilot
            deploys the merge. No kubectl.
          </>
        }
      />

      <CreateServicePanel />
    </div>
  );
}
