"use client";

import { useNarrative } from "../lib/narrative";

type StepId = 1 | 2 | 3;

const STEPS: Array<{ id: StepId; idp: string; interstellar: string }> = [
  { id: 1, idp: "Basic Service Info", interstellar: "Robot Basics" },
  { id: 2, idp: "Tech Stack", interstellar: "Chassis & Stack" },
  { id: 3, idp: "Service Configuration", interstellar: "Calibration" },
];

export function WizardStepper({
  step,
  furthest,
  onGo,
}: {
  step: StepId;
  furthest: StepId;
  onGo: (step: StepId) => void;
}) {
  const { mode } = useNarrative();
  return (
    <div className="wiz-steps" role="list" aria-label="Create steps">
      {STEPS.map((entry) => {
        const state = entry.id === step ? "active" : entry.id < step ? "done" : "";
        const clickable = entry.id <= furthest && entry.id !== step;
        return (
          <button
            key={entry.id}
            type="button"
            className={`wiz-step${state ? ` ${state}` : ""}`}
            role="listitem"
            aria-current={entry.id === step ? "step" : undefined}
            disabled={entry.id > furthest}
            onClick={() => clickable && onGo(entry.id)}
          >
            <span className="wiz-step-num">{entry.id < step ? "✓" : entry.id}</span>
            <span className="wiz-step-label">{mode === "interstellar" ? entry.interstellar : entry.idp}</span>
          </button>
        );
      })}
    </div>
  );
}
