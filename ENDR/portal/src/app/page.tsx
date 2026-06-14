"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";

import * as Icon from "./components/icons";
import { journeyStages, useNarrative, type NarrativeMode } from "./lib/narrative";
import { useTheme } from "./lib/theme";

const GITHUB_URL = "https://github.com/calavelas/ENDR";

interface LandingCopy {
  eyebrow: string;
  title: string;
  highlight: string;
  subcopy: string;
  enterCta: string;
  createCta: string;
  features: Array<{ icon: keyof typeof Icon; title: string; body: string }>;
  flowTitle: string;
  flowCopy: string;
}

const COPY: Record<NarrativeMode, LandingCopy> = {
  idp: {
    eyebrow: "Internal Developer Platform",
    title: "Ship services the",
    highlight: "golden-path way.",
    subcopy:
      "ENDR turns a service request into a running, observable deployment — through Git, pull requests, and ArgoCD. No tickets, no hand-offs, one source of truth.",
    enterCta: "Enter the platform",
    createCta: "Create a service",
    features: [
      {
        icon: "FileText",
        title: "Golden-path templates",
        body: "Pick a template; ENDR scaffolds a production-ready service with sane defaults and a clean repo layout.",
      },
      {
        icon: "Github",
        title: "GitOps by pull request",
        body: "Every change is a PR. CI validates it, policy gates guard it, and it auto-merges — the repo stays the single source of truth.",
      },
      {
        icon: "Rocket",
        title: "ArgoCD delivery",
        body: "Merged config reconciles into Helm charts and ArgoCD applications, then rolls out and self-heals automatically.",
      },
      {
        icon: "Bot",
        title: "TARS & CASE copilots",
        body: "Two assistants explain the platform, answer how-it-works questions, and walk you through every step.",
      },
    ],
    flowTitle: "One GitOps loop, end to end",
    flowCopy: "From a declaration in the portal to a live, monitored service — the same six stages every time.",
  },
  interstellar: {
    eyebrow: "Interstellar Development Platform",
    title: "Build a robot.",
    highlight: "Launch it across the galaxy.",
    subcopy:
      "ENDR turns a mission request into a living robot on a distant planet — through Git, pull requests, and autopilot. Watch it come online, then talk back to it.",
    enterCta: "Enter Mission Control",
    createCta: "Build a robot",
    features: [
      {
        icon: "FileText",
        title: "Mission blueprints",
        body: "Pick a blueprint; ENDR assembles a flight-ready robot with sane defaults and a clean mission record.",
      },
      {
        icon: "Github",
        title: "GitOps by pull request",
        body: "Every mission is a PR. Inspection clears it, policy gates guard it, and it auto-merges into the mission log.",
      },
      {
        icon: "Rocket",
        title: "Autopilot delivery",
        body: "Approved specs reconcile into charts and autopilot apps, and the robot powers on across the system automatically.",
      },
      {
        icon: "Bot",
        title: "TARS & CASE",
        body: "Two crewmates explain the station, answer your questions, and walk you through every step of the mission.",
      },
    ],
    flowTitle: "One mission loop, end to end",
    flowCopy: "From a blueprint on the bridge to a robot online on a far planet — the same six stages every time.",
  },
};

function ModeToggle({ mode, setMode }: { mode: NarrativeMode; setMode: (m: NarrativeMode) => void }) {
  return (
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
  );
}

export default function LandingPage() {
  const { mode, setMode } = useNarrative();
  const { theme, toggle: toggleTheme } = useTheme();
  // Avoid SSR/first-paint mismatch: narrative + theme settle right after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const copy = COPY[mode];
  const stages = journeyStages(mode);

  return (
    <div className="endr-page lp" data-mounted={mounted ? "1" : "0"}>
      <header className="lp-top">
        <span className="lp-mark">ENDR</span>
        <div className="lp-top-actions">
          <ModeToggle mode={mode} setMode={setMode} />
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
            {copy.enterCta}
            <Icon.ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <main className="lp-main">
        <section className="lp-hero">
          <span className="lp-eyebrow">
            <span className="lp-eyebrow-dot" />
            {copy.eyebrow}
          </span>
          <h1 className="lp-title">
            {copy.title} <span className="lp-title-accent">{copy.highlight}</span>
          </h1>
          <p className="lp-sub">{copy.subcopy}</p>
          <div className="lp-cta-row">
            <Link href="/dashboard" className="lp-btn lp-btn-primary lp-btn-lg">
              {copy.enterCta}
              <Icon.ArrowRight size={17} />
            </Link>
            <Link href="/create" className="lp-btn lp-btn-soft lp-btn-lg">
              <Icon.Plus size={16} />
              {copy.createCta}
            </Link>
            <Link href="/architecture" className="lp-btn lp-btn-link lp-btn-lg">
              Under the hood
              <Icon.ChevronRight size={15} />
            </Link>
          </div>
        </section>

        <section className="lp-features" aria-label="Platform capabilities">
          {copy.features.map((feature) => {
            const Glyph = Icon[feature.icon] as ComponentType<{ size?: number }>;
            return (
              <article className="lp-feature" key={feature.title}>
                <span className="lp-feature-ic">
                  <Glyph size={20} />
                </span>
                <h3 className="lp-feature-title">{feature.title}</h3>
                <p className="lp-feature-body">{feature.body}</p>
              </article>
            );
          })}
        </section>

        <section className="lp-flow" aria-label="How it works">
          <div className="lp-flow-head">
            <h2 className="lp-flow-title">{copy.flowTitle}</h2>
            <p className="lp-flow-copy">{copy.flowCopy}</p>
          </div>
          <ol className="lp-stages">
            {stages.map((stage, index) => (
              <li className="lp-stage" key={stage.id}>
                <span className="lp-stage-num">{index + 1}</span>
                <span className="lp-stage-label">{stage.label}</span>
                <span className="lp-stage-sub">{stage.sub}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-band">
          <div className="lp-band-text">
            <h2 className="lp-band-title">See it run.</h2>
            <p className="lp-band-copy">
              Open the platform, create your first {mode === "interstellar" ? "robot" : "service"}, and
              watch the whole pipeline carry it to production.
            </p>
          </div>
          <div className="lp-band-actions">
            <Link href="/dashboard" className="lp-btn lp-btn-primary lp-btn-lg">
              {copy.enterCta}
              <Icon.ArrowRight size={17} />
            </Link>
            <Link href="/architecture" className="lp-btn lp-btn-soft lp-btn-lg">
              How it works
            </Link>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <span className="lp-foot-mark">ENDR</span>
        <span className="lp-foot-mid">Internal Developer Platform · GitOps demo</span>
        <a className="lp-foot-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
          <Icon.Github size={14} />
          GitHub
          <Icon.ExternalLink size={12} />
        </a>
      </footer>
    </div>
  );
}
