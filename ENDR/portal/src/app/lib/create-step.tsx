"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

// Lets the create wizard tell the floating assistant which sub-step the user is
// on, so the robot's guidance tracks the form (Basics → Stack → Config → Review →
// Submitted). Value + setter live in separate contexts so the wizard (setter
// only) doesn't re-render when the value changes, and vice-versa.
//
// Values are journey node ids the assistant understands: create-basics,
// create-stack, create-config, create-review, create-submitted (or null = not on
// the create page).
export type CreateStepId =
  | "create-basics"
  | "create-stack"
  | "create-config"
  | "create-review"
  | "create-submitted"
  | null;

const ValueContext = createContext<CreateStepId>(null);
const SetContext = createContext<(step: CreateStepId) => void>(() => {});

export function CreateStepProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<CreateStepId>(null);
  const set = useCallback((next: CreateStepId) => setStep(next), []);
  return (
    <SetContext.Provider value={set}>
      <ValueContext.Provider value={step}>{children}</ValueContext.Provider>
    </SetContext.Provider>
  );
}

export function useCreateStep(): CreateStepId {
  return useContext(ValueContext);
}

export function useSetCreateStep(): (step: CreateStepId) => void {
  return useContext(SetContext);
}
