"use client";

import { useNarrative } from "../lib/narrative";

// The create-page intro, styled as a hero card (matches the service-detail hero).
// Narrative-aware: the guided-flow + Day-0 explainer in IDP or Interstellar voice.
export function CreateHero() {
  const { mode } = useNarrative();
  const title = mode === "interstellar" ? "Build a robot" : "Scaffold a new service";

  return (
    <section className="mc-panel mc-detail-hero mc-create-hero">
      <span className="mc-detail-sub">{mode === "interstellar" ? "New mission from a blueprint" : "New service from a template"}</span>
      <h1 className="mc-detail-hero-title">{title}</h1>
      <div className="mc-hero-body">
        {mode === "interstellar" ? (
          <>
            <p>
              A guided flow — <b>basics → chassis → calibration → review</b>. Every step edits one entry in{" "}
              <code>services.yaml</code>, the <b>desired-state catalog</b>. On <b>Create</b>, ENDR opens a{" "}
              <b>pull request</b> adding that entry; the reconcile workflow forges the scaffold, Helm chart and
              ArgoCD app, and the autopilot deploys the merge. No kubectl.
            </p>
            <p>
              <b>Day-0 bootstrap only.</b> This seeds <code>services.yaml</code> — <em>what should exist</em>, not
              the running config. After launch the robot is configured through its own generated GitOps chart (
              <em>how it actually runs</em>); the catalog only tracks desired state.
            </p>
          </>
        ) : (
          <>
            <p>
              A guided flow — <b>basics → tech stack → configuration → review</b>. Every step edits one entry in{" "}
              <code>services.yaml</code>, the platform&apos;s <b>desired-state catalog</b>. On <b>Create</b>, ENDR
              opens a <b>pull request</b> adding that entry; the reconcile workflow generates the app scaffold, Helm
              chart and ArgoCD app, and ArgoCD deploys the merge. No kubectl.
            </p>
            <p>
              <b>Day-0 bootstrap only.</b> This seeds <code>services.yaml</code> — <em>what should exist</em>, not
              the running config. After creation the service is configured through its own generated GitOps chart (
              <em>how it actually runs</em>); the catalog only tracks desired state.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
