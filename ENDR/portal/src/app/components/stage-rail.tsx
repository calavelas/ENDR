"use client";

import { journeyStages, stageIndex, useNarrative, type StageId } from "../lib/narrative";

// The IDP delivery flow, rendered as a rail with the current stage highlighted.
// Same component, relabelled live by the narrative toggle (Declare/Commit/… in
// IDP, Design/File spec/… in Interstellar). Mirrors DOCS/robot-demo-mockup.html.
export function StageRail({ active }: { active: StageId }) {
  const { mode } = useNarrative();
  const stages = journeyStages(mode);
  const activeIdx = stageIndex(active);

  return (
    <div className={`stage-rail${mode === "idp" ? " idp" : ""}`} role="list" aria-label="Delivery flow">
      {stages.map((stage, index) => {
        const state = index < activeIdx ? "done" : index === activeIdx ? "active" : "";
        return (
          <div className={`stage-rail-item${state ? ` ${state}` : ""}`} role="listitem" key={stage.id}>
            <span className="stage-rail-label">{stage.label}</span>
            <span className="stage-rail-sub">{stage.sub}</span>
          </div>
        );
      })}
    </div>
  );
}
