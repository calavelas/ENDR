"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import * as Icon from "../components/icons";
import { platformServiceLabel, useNarrative, type NarrativeMode } from "../lib/narrative";
import { useTheme } from "../lib/theme";

interface PipelineStep {
  key: string;
  title: string;
  body: string;
}

const PIPELINE: PipelineStep[] = [
  {
    key: "declare",
    title: "1 · Declare",
    body: "In the portal you request a service — name, template, namespace, environment. The API opens a pull request that adds one entry to services.yaml. Nothing touches the cluster yet; the change is a proposal.",
  },
  {
    key: "validate",
    title: "2 · Validate",
    body: "“PR Check · Service catalog” runs on the PR: it reconciles the catalog to prove it’s clean and runs policy-as-code (robot-validate) on any changed robot. Each stage posts a plain-language comment back onto the PR.",
  },
  {
    key: "merge",
    title: "3 · Merge",
    body: "Owner-authored, services.yaml-only portal PRs auto-approve and squash-merge. From here, the git repo is the single source of truth for what should be running.",
  },
  {
    key: "reconcile",
    title: "4 · Reconcile",
    body: "“Reconcile · Catalog → manifests” renders services.yaml into a per-service Helm chart (SVCS/<name>/chart) and an ArgoCD Application, then pushes those generated manifests back to main.",
  },
  {
    key: "build",
    title: "5 · Build",
    body: "If application source changed, “Build · Service images” builds and publishes the container image and pins its tag back into the chart. Robots reuse one shared image, so a new robot skips this step.",
  },
  {
    key: "deliver",
    title: "6 · Deliver",
    body: "ArgoCD’s “services” app-of-apps notices the new child Application, syncs it, and the workload comes online — reachable at <name>.calavelas.net. ArgoCD then keeps the cluster matching git and self-heals drift.",
  },
  {
    key: "operate",
    title: "7 · Operate & retire",
    body: "Edit config opens an env-only PR; Decommission removes the services.yaml entry, reconcile prunes the chart + Application, and ArgoCD removes the workload. Demo-created units also auto-retire after 30 minutes.",
  },
];

interface Component {
  name: string; // canonical platform-service key (for the interstellar alias)
  display: string;
  body: string;
}

const COMPONENTS: Component[] = [
  {
    name: "portal",
    display: "Portal",
    body: "Next.js UI. Read-only views plus the create / edit / decommission actions. It talks to the API server-side, so the browser never sees a token.",
  },
  {
    name: "api",
    display: "API",
    body: "FastAPI. Holds the GitHub token, opens and guards pull requests, and enforces protection — a protected unit gets a 403, and state is re-checked at merge time to avoid TOCTOU races.",
  },
  {
    name: "core",
    display: "Engine",
    body: "Python. The reconcile renderer, the service scaffolder, and the policy validators (robot-validate). It runs both in CI and inside the API image.",
  },
  {
    name: "services",
    display: "services.yaml",
    body: "Desired state. The one file humans or the portal edit to add, retune, or remove a service. Everything else is generated from it.",
  },
  {
    name: "argocd",
    display: "ArgoCD",
    body: "Continuous delivery. An app-of-apps named “services” owns every child Application and continuously reconciles the cluster to match git.",
  },
  {
    name: "gateway",
    display: "Robots",
    body: "Every robot runs the SAME endr-robot image — behavior is purely env-driven (calibration, name, catchphrase). One image, many personalities.",
  },
];

interface Workflow {
  name: string;
  trigger: string;
  does: string;
}

const WORKFLOWS: Workflow[] = [
  { name: "PR Check · Service catalog", trigger: "PR touching services.yaml", does: "Validate + auto-merge create / decommission PRs." },
  { name: "PR Check · Config edit", trigger: "PR touching a chart values.yaml", does: "Enforce env-only changes, then auto-merge." },
  { name: "Reconcile · Catalog → manifests", trigger: "push to services.yaml", does: "Render charts + ArgoCD apps, push, trigger the build." },
  { name: "Build · Service images", trigger: "dispatched by reconcile", does: "Build + publish changed application images." },
  { name: "Build · Platform images", trigger: "push to portal / api", does: "Build + publish the portal and api images." },
  { name: "Build · Robot image", trigger: "push to robot image source", does: "Build the one shared endr-robot image." },
];

const GUARDRAILS: Array<{ title: string; body: string }> = [
  { title: "Pull-request only", body: "Nothing reaches the cluster without a merged PR. Git is the audit log and the rollback point." },
  { title: "Env-only edit gate", body: "The edit flow may only change the env block — image, route, and resources are locked, so a PR can’t swap the image or hijack the route." },
  { title: "Owner-only auto-merge", body: "Only the repo owner’s portal PRs auto-merge, and only when they touch the expected file. Anything else waits for a human." },
  { title: "Protected core units", body: "TARS and CASE set ENDR_ALLOW_SELF_DESTRUCT=false and can never self-decommission — enforced at the robot, at the API (403 + re-check), and in CI." },
  { title: "Policy-as-code", body: "robot-validate blocks malformed calibration at the PR. An uncalibrated robot booting MALFUNCTION is a notice, not a failure." },
];

function modeNote(mode: NarrativeMode): string {
  return mode === "interstellar"
    ? "You’re in Interstellar mode — component names show their mission aliases. The mechanics are identical."
    : "The plain platform view. Flip to Interstellar mode for the themed aliases.";
}

export default function ArchitecturePage() {
  const { mode, setMode } = useNarrative();
  const { theme, toggle: toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="endr-page lp uh" data-mounted={mounted ? "1" : "0"}>
      <header className="lp-top">
        <Link href="/" className="lp-mark lp-mark-link">
          <Icon.ChevronLeft size={15} />
          ENDR
        </Link>
        <div className="lp-top-actions">
          <div className="lp-seg" role="group" aria-label="Narrative mode">
            <button
              type="button"
              className={`lp-seg-opt${mode === "idp" ? " on" : ""}`}
              onClick={() => setMode("idp")}
              aria-pressed={mode === "idp"}
            >
              IDP
            </button>
            <button
              type="button"
              className={`lp-seg-opt${mode === "interstellar" ? " on" : ""}`}
              onClick={() => setMode("interstellar")}
              aria-pressed={mode === "interstellar"}
            >
              Interstellar
            </button>
          </div>
          <button
            type="button"
            className="lp-icon-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <Icon.Sun /> : <Icon.Moon />}
          </button>
          <Link href="/dashboard" className="lp-btn lp-btn-ghost lp-top-enter">
            Enter the platform
            <Icon.ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <main className="lp-main">
        <section className="lp-hero">
          <span className="lp-eyebrow">
            <span className="lp-eyebrow-dot" />
            Under the hood
          </span>
          <h1 className="lp-title">
            How ENDR turns a request into a <span className="lp-title-accent">running service.</span>
          </h1>
          <p className="lp-sub">
            ENDR is a GitOps Internal Developer Platform. A request becomes a pull request, CI proves
            it’s safe, it auto-merges, and ArgoCD delivers it — declaratively, with the repo as the
            single source of truth. {modeNote(mode)}
          </p>
        </section>

        {/* The pipeline */}
        <section className="uh-section" aria-label="The delivery pipeline">
          <h2 className="uh-h2">The delivery pipeline</h2>
          <ol className="uh-pipe">
            {PIPELINE.map((step) => (
              <li className="uh-pipe-step" key={step.key}>
                <h3 className="uh-pipe-title">{step.title}</h3>
                <p className="uh-pipe-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Components */}
        <section className="uh-section" aria-label="Building blocks">
          <h2 className="uh-h2">Building blocks</h2>
          <div className="uh-grid">
            {COMPONENTS.map((component) => {
              const alias = platformServiceLabel(component.name, mode);
              const showAlias = mode === "interstellar" && alias.toLowerCase() !== component.display.toLowerCase();
              return (
                <article className="uh-card" key={component.display}>
                  <h3 className="uh-card-title">
                    {component.display}
                    {showAlias ? <span className="uh-alias">{alias}</span> : null}
                  </h3>
                  <p className="uh-card-body">{component.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* Workflows */}
        <section className="uh-section" aria-label="CI/CD workflows">
          <h2 className="uh-h2">The CI/CD workflows</h2>
          <p className="uh-lead">
            Six GitHub Actions workflows carry every change. PR-layer checks run on the open PR;
            post-merge workflows render and build, then comment progress back onto the PR.
          </p>
          <div className="uh-table-wrap">
            <table className="uh-table">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>Runs on</th>
                  <th>What it does</th>
                </tr>
              </thead>
              <tbody>
                {WORKFLOWS.map((workflow) => (
                  <tr key={workflow.name}>
                    <td className="uh-mono">{workflow.name}</td>
                    <td>{workflow.trigger}</td>
                    <td>{workflow.does}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Guardrails */}
        <section className="uh-section" aria-label="Guardrails">
          <h2 className="uh-h2">Guardrails</h2>
          <div className="uh-grid uh-grid-2">
            {GUARDRAILS.map((guard) => (
              <article className="uh-card" key={guard.title}>
                <h3 className="uh-card-title">
                  <Icon.CheckCircle size={15} />
                  {guard.title}
                </h3>
                <p className="uh-card-body">{guard.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Calibration */}
        <section className="uh-section" aria-label="Robot calibration">
          <h2 className="uh-h2">Robot calibration</h2>
          <p className="uh-lead">
            Every robot is the same image; its character is just configuration in{" "}
            <code className="uh-code">overrides.env</code>.
          </p>
          <div className="uh-grid uh-grid-2">
            <article className="uh-card">
              <h3 className="uh-card-title">HUMOR · HONESTY · TRUST</h3>
              <p className="uh-card-body">
                Three dials, 0–100. A robot is <b>ONLINE</b> only when the sum is above zero —
                otherwise it boots into <b>MALFUNCTION</b> and tells you exactly what to set.
              </p>
            </article>
            <article className="uh-card">
              <h3 className="uh-card-title">ROBOT_NAME · CATCHPHRASE</h3>
              <p className="uh-card-body">
                Identity and voice. Required when you create a robot — the portal blocks an empty
                name or catchphrase before the PR is ever opened.
              </p>
            </article>
          </div>
        </section>

        <section className="lp-band">
          <div className="lp-band-text">
            <h2 className="lp-band-title">Now go run it.</h2>
            <p className="lp-band-copy">
              Open the platform and walk a change through the whole pipeline — TARS and CASE will
              guide you at each step.
            </p>
          </div>
          <div className="lp-band-actions">
            <Link href="/dashboard" className="lp-btn lp-btn-primary lp-btn-lg">
              Enter the platform
              <Icon.ArrowRight size={17} />
            </Link>
            <Link href="/create" className="lp-btn lp-btn-soft lp-btn-lg">
              <Icon.Plus size={16} />
              {mode === "interstellar" ? "Build a robot" : "Create a service"}
            </Link>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <span className="lp-foot-mark">ENDR</span>
        <span className="lp-foot-mid">Internal Developer Platform · GitOps demo</span>
        <a className="lp-foot-link" href="https://github.com/calavelas/ENDR" target="_blank" rel="noreferrer">
          <Icon.Github size={14} />
          GitHub
          <Icon.ExternalLink size={12} />
        </a>
      </footer>
    </div>
  );
}
