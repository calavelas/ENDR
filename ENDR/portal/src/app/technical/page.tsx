"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import * as Icon from "../components/icons";
import { loadSnapshot, type PlatformSnapshot, type ServiceNode } from "../lib/platform";
import { useTheme } from "../lib/theme";
import graphSummary from "./graph-summary.json";

// ── Section anchor nav ────────────────────────────────────────────────────────
interface Section {
  id: string;
  label: string;
}

const SECTIONS: Section[] = [
  { id: "overview", label: "Overview" },
  { id: "modules", label: "Module map" },
  { id: "data-flow", label: "Data flow" },
  { id: "live", label: "Live platform state" },
  { id: "api", label: "API surface" },
  { id: "workflows", label: "CI/CD workflows" },
  { id: "gitops", label: "GitOps & robot fleet" },
  { id: "graph", label: "Code graph" },
  { id: "layout", label: "Repo layout" },
];

// ── Static content ────────────────────────────────────────────────────────────
interface Module {
  name: string;
  body: string;
}

const MODULES: Module[] = [
  {
    name: "portal",
    body: "Next.js developer portal (this app). Pages: dashboard, catalog, create, history, argocd, architecture, technical.",
  },
  {
    name: "api",
    body: "FastAPI backend, serves /api/platform. Modules: main, router, snapshot, transactions.",
  },
  {
    name: "engine",
    body: "Python automation library + CLI: config/ (loader + IDPConfig models), scaffold/, templates/, cli/, engine.py (services-check / reconcile).",
  },
  {
    name: "scripts",
    body: "Bootstrap / dev / CI + Makefile (dev-start, bootstrap, services-check, services-sync, validate-config, smoke-test, api, web).",
  },
];

interface FlowStep {
  title: string;
  body: string;
}

const DATA_FLOW: FlowStep[] = [
  {
    title: "1 · Declare",
    body: "Create form → POST /api/platform/services → the API opens a GitHub PR adding one entry to services.yaml. The cluster is untouched.",
  },
  {
    title: "2 · Validate",
    body: "reconcile-pr.yml runs on the PR: it reconciles the catalog (proves clean) + the robot-validate policy on changed robots, then posts plain-language PR comments.",
  },
  {
    title: "3 · Merge",
    body: "Owner-authored, services.yaml-only portal PRs auto-approve and squash-merge. Git is now the source of truth.",
  },
  {
    title: "4 · Reconcile",
    body: "reconcile.yml renders services.yaml → a per-service Helm chart (SVCS/<name>/chart) + an ArgoCD Application, then pushes the generated manifests to main.",
  },
  {
    title: "5 · Build",
    body: "If app source changed, services-build.yml builds/publishes the image and pins its tag into the chart. Robots reuse one shared endr-robot image (build skipped). platform-build.yml builds the portal + api images.",
  },
  {
    title: "6 · Deliver",
    body: "The ArgoCD services app-of-apps syncs the new child Application; the workload comes online at <name>.calavelas.net; ArgoCD self-heals drift.",
  },
  {
    title: "7 · Operate / retire",
    body: "Edit config = an env-only PR; Decommission removes the services.yaml entry, reconcile prunes the chart + Application, ArgoCD removes the workload. Demo units auto-retire after ~30 min.",
  },
];

interface ApiGroup {
  group: string;
  rows: Array<{ verb: string; path: string; note: string }>;
}

const API_SURFACE: ApiGroup[] = [
  {
    group: "Platform read",
    rows: [
      { verb: "GET", path: "/api/platform", note: "Full platform snapshot" },
      { verb: "GET", path: "/api/platform/templates", note: "Available templates" },
      { verb: "GET", path: "/api/platform/template-file", note: "One template file" },
      { verb: "GET", path: "/api/platform/history", note: "Delivery history" },
      { verb: "GET", path: "/api/platform/transactions/{pullRequestNumber}", note: "In-flight change status" },
    ],
  },
  {
    group: "Service ops",
    rows: [
      { verb: "POST", path: "/api/platform/services", note: "Create → PR" },
      { verb: "GET", path: "/api/platform/services/{name}/argocd", note: "Per-service ArgoCD detail" },
      { verb: "GET", path: "/api/platform/services/{name}/files", note: "List service files" },
      { verb: "GET", path: "/api/platform/services/{name}/file", note: "Read a service file" },
      { verb: "POST", path: "/api/platform/services/{name}/file", note: "Edit → PR" },
      { verb: "GET", path: "/api/platform/services/{name}/decommission", note: "Eligibility" },
      { verb: "POST", path: "/api/platform/services/{name}/decommission", note: "Decommission → PR" },
    ],
  },
  {
    group: "Config / health",
    rows: [
      { verb: "GET", path: "/api/health", note: "Liveness" },
      { verb: "GET", path: "/api/config", note: "Effective config" },
      { verb: "GET", path: "/api/config/validate", note: "Validate config" },
    ],
  },
  {
    group: "Legacy",
    rows: [{ verb: "POST", path: "/api/services", note: "Superseded by /api/platform/services" }],
  },
];

interface Workflow {
  file: string;
  does: string;
}

const WORKFLOWS: Workflow[] = [
  { file: "reconcile-pr.yml", does: "PR check: reconcile catalog + robot-validate policy; posts PR comments." },
  { file: "reconcile.yml", does: "On merge to main: render services.yaml → charts + ArgoCD apps, push generated manifests." },
  { file: "services-build.yml", does: "Build/publish service images for changed SVCS/<name> source; pin tag." },
  { file: "platform-build.yml", does: "Build/publish portal + api images; bump chart values." },
  { file: "robot-build.yml", does: "Build/publish the shared endr-robot image." },
  { file: "config-edit-pr.yml", does: "Handles config-edit PRs." },
];

interface RepoEntry {
  path: string;
  body: string;
}

const REPO_LAYOUT: RepoEntry[] = [
  { path: "platform.yaml, services.yaml", body: "Root config." },
  { path: "ENDR/", body: "portal, api, engine, scripts." },
  { path: "SVCS/", body: "Deployable service definitions (code + Helm chart per service; current: tars, case)." },
  { path: "KUBE/", body: "ArgoCD + GitOps manifests, policies, monitoring (clusters/gargantua)." },
  { path: ".github/workflows/", body: "CI." },
  { path: "DOCS/, REFS/", body: "Docs, legacy references." },
  { path: ".graphify/", body: "Code graph." },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TechnicalPage() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [snapshot, setSnapshot] = useState<PlatformSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    let active = true;
    loadSnapshot()
      .then((snap) => {
        if (active) setSnapshot(snap);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // loadSnapshot() never throws — on failure it returns a fallback snapshot
  // tagged dataSource === "fallback". Treat that as "live data unavailable".
  const liveUnavailable = !snapshot || snapshot.dataSource === "fallback";
  const services: ServiceNode[] = snapshot?.services ?? [];

  const namespaces = useMemo(
    () => Array.from(new Set(services.map((s) => s.namespace))).sort(),
    [services],
  );
  const templates = useMemo(
    () =>
      Array.from(
        new Set(services.map((s) => s.templateName).filter((t): t is string => Boolean(t))),
      ).sort(),
    [services],
  );

  return (
    <div className="endr-page lp uh" data-mounted={mounted ? "1" : "0"}>
      <header className="lp-top">
        <Link href="/" className="lp-mark lp-mark-link">
          <Icon.ChevronLeft size={15} />
          ENDR
        </Link>
        <div className="lp-top-actions">
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
            Technical reference
          </span>
          <h1 className="lp-title">
            ENDR, <span className="lp-title-accent">engineering view.</span>
          </h1>
          <p className="lp-sub">
            The platform&apos;s moving parts — modules, data flow, the API surface, CI/CD, GitOps,
            and the code graph — in one reference.
          </p>
          <p className="uh-card-body" style={{ marginTop: "0.9rem", fontSize: "0.8rem" }}>
            Live sections render from /api/platform; graph stats from a generated summary.
            Hand-written sections current as of commit a107f97 (2026-06-15).
          </p>
        </section>

        {/* Section nav */}
        <nav className="uh-section" aria-label="Sections" style={{ marginBottom: "-1rem" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="lp-btn lp-btn-soft"
                style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}
              >
                {section.label}
              </a>
            ))}
          </div>
        </nav>

        {/* 1 — Overview */}
        <section className="uh-section" id="overview" aria-label="Overview">
          <h2 className="uh-h2">Overview</h2>
          <p className="uh-lead">
            ENDR is a config-driven internal developer platform (IDP). GitHub is the source of
            truth; a Next.js portal requests and operates services; a FastAPI backend serves
            platform state; a Python automation engine reconciles config into Helm charts + ArgoCD
            Applications; ArgoCD syncs them to a local k3d cluster (<code className="uh-code">gargantua</code>)
            and self-heals drift.
          </p>
        </section>

        {/* 2 — Module map */}
        <section className="uh-section" id="modules" aria-label="Module map">
          <h2 className="uh-h2">Module map · the ENDR/ umbrella</h2>
          <div className="uh-grid uh-grid-2">
            {MODULES.map((mod) => (
              <article className="uh-card" key={mod.name}>
                <h3 className="uh-card-title">
                  <code className="uh-code">{mod.name}</code>
                </h3>
                <p className="uh-card-body">{mod.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 3 — Data flow */}
        <section className="uh-section" id="data-flow" aria-label="Data flow">
          <h2 className="uh-h2">Data flow</h2>
          <ol className="uh-pipe">
            {DATA_FLOW.map((step) => (
              <li className="uh-pipe-step" key={step.title}>
                <h3 className="uh-pipe-title">{step.title}</h3>
                <p className="uh-pipe-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 4 — Live platform state */}
        <section className="uh-section" id="live" aria-label="Live platform state">
          <h2 className="uh-h2">Live platform state</h2>
          {loading ? (
            <p className="uh-lead">Loading live platform state…</p>
          ) : liveUnavailable ? (
            <p className="uh-lead">
              <Icon.AlertTriangle size={15} /> Live data unavailable — the platform API could not be
              reached. Showing no live services.
            </p>
          ) : (
            <>
              <p className="uh-lead">
                {services.length} service{services.length === 1 ? "" : "s"} across{" "}
                {namespaces.length} namespace{namespaces.length === 1 ? "" : "s"}. servicesPath:{" "}
                <code className="uh-code">{snapshot?.servicesPath}</code>
              </p>
              <div className="uh-table-wrap">
                <table className="uh-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Namespace</th>
                      <th>Template</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.length === 0 ? (
                      <tr>
                        <td colSpan={3}>No services currently declared.</td>
                      </tr>
                    ) : (
                      services.map((service) => (
                        <tr key={service.name}>
                          <td className="uh-mono">{service.name}</td>
                          <td>{service.namespace}</td>
                          <td>{service.templateName ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="uh-grid uh-grid-2" style={{ marginTop: "1rem" }}>
                <article className="uh-card">
                  <h3 className="uh-card-title">Namespaces ({namespaces.length})</h3>
                  <p className="uh-card-body uh-mono">
                    {namespaces.length ? namespaces.join(", ") : "—"}
                  </p>
                </article>
                <article className="uh-card">
                  <h3 className="uh-card-title">Templates ({templates.length})</h3>
                  <p className="uh-card-body uh-mono">
                    {templates.length ? templates.join(", ") : "—"}
                  </p>
                </article>
              </div>
            </>
          )}
        </section>

        {/* 5 — API surface */}
        <section className="uh-section" id="api" aria-label="API surface">
          <h2 className="uh-h2">API surface</h2>
          <p className="uh-lead">As of commit a107f97.</p>
          <div className="uh-table-wrap">
            <table className="uh-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {API_SURFACE.flatMap((grp) =>
                  grp.rows.map((row, idx) => (
                    <tr key={`${grp.group}-${row.verb}-${row.path}`}>
                      <td>{idx === 0 ? grp.group : ""}</td>
                      <td className="uh-mono">{row.verb}</td>
                      <td className="uh-mono">{row.path}</td>
                      <td>{row.note}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 6 — CI/CD workflows */}
        <section className="uh-section" id="workflows" aria-label="CI/CD workflows">
          <h2 className="uh-h2">CI/CD workflows · .github/workflows/</h2>
          <div className="uh-table-wrap">
            <table className="uh-table">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>What it does</th>
                </tr>
              </thead>
              <tbody>
                {WORKFLOWS.map((wf) => (
                  <tr key={wf.file}>
                    <td className="uh-mono">{wf.file}</td>
                    <td>{wf.does}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 7 — GitOps & robot fleet */}
        <section className="uh-section" id="gitops" aria-label="GitOps and robot fleet">
          <h2 className="uh-h2">GitOps &amp; robot fleet</h2>
          <div className="uh-grid uh-grid-2">
            <article className="uh-card">
              <h3 className="uh-card-title">App-of-apps tree</h3>
              <p className="uh-card-body">
                core → platform → services Application tree (
                <code className="uh-code">KUBE/clusters/gargantua/core.yaml</code>).
              </p>
            </article>
            <article className="uh-card">
              <h3 className="uh-card-title">Cluster</h3>
              <p className="uh-card-body">
                Single local k3d cluster <code className="uh-code">gargantua</code>. App namespaces:
                miller, mann, edmunds. Platform namespaces: argocd, gateway, cloudflare, endr.
              </p>
            </article>
            <article className="uh-card">
              <h3 className="uh-card-title">Robot fleet</h3>
              <p className="uh-card-body">
                Services from the endr-robot template — one shared image, personality via env
                (ROBOT_NAME, HUMOR, HONESTY, TRUST, CATCHPHRASE). The current fleet is shown live
                above.
              </p>
            </article>
            <article className="uh-card">
              <h3 className="uh-card-title">Namespace guardrail</h3>
              <p className="uh-card-body">
                Fail-closed — a service with an unknown namespace is rejected.
              </p>
            </article>
            <article className="uh-card">
              <h3 className="uh-card-title">Templates</h3>
              <p className="uh-card-body">
                endr-robot, python-fastapi (service); helm-service (gitops).
              </p>
            </article>
          </div>
        </section>

        {/* 8 — Code graph */}
        <section className="uh-section" id="graph" aria-label="Code graph">
          <h2 className="uh-h2">Code graph</h2>
          <p className="uh-lead">
            Built from commit <code className="uh-code">{graphSummary.builtFromCommit}</code>,
            generated {graphSummary.generatedAt}.
          </p>
          <div className="uh-grid">
            <article className="uh-card">
              <h3 className="uh-card-title">Corpus</h3>
              <p className="uh-card-body">
                {graphSummary.corpus.files} files · {graphSummary.corpus.sensitiveExcluded}{" "}
                sensitive files excluded.
              </p>
            </article>
            <article className="uh-card">
              <h3 className="uh-card-title">Graph</h3>
              <p className="uh-card-body">
                {graphSummary.graph.nodes} nodes · {graphSummary.graph.edges} edges ·{" "}
                {graphSummary.graph.communities} communities.
              </p>
            </article>
            <article className="uh-card">
              <h3 className="uh-card-title">Edge kinds</h3>
              <p className="uh-card-body uh-mono">
                {Object.entries(graphSummary.edgeKinds)
                  .map(([kind, count]) => `${kind}: ${count}`)
                  .join(" · ")}
              </p>
            </article>
          </div>
          <div className="uh-table-wrap" style={{ marginTop: "1rem" }}>
            <table className="uh-table">
              <thead>
                <tr>
                  <th>God node</th>
                  <th>Edges</th>
                  <th>What</th>
                </tr>
              </thead>
              <tbody>
                {graphSummary.godNodes.map((node) => (
                  <tr key={node.name}>
                    <td className="uh-mono">{node.name}</td>
                    <td className="uh-mono">{node.edges}</td>
                    <td>{node.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="uh-card-body" style={{ marginTop: "0.8rem" }}>
            Derived from graphify; regenerated on graph refresh.
          </p>
        </section>

        {/* 9 — Repo layout */}
        <section className="uh-section" id="layout" aria-label="Repo layout">
          <h2 className="uh-h2">Repo layout</h2>
          <div className="uh-table-wrap">
            <table className="uh-table">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Contents</th>
                </tr>
              </thead>
              <tbody>
                {REPO_LAYOUT.map((entry) => (
                  <tr key={entry.path}>
                    <td className="uh-mono">{entry.path}</td>
                    <td>{entry.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="uh-card-body" style={{ marginTop: "0.8rem" }}>
            Note: the SVCS/ directory is intentionally still named SVCS/ — only the config file was
            renamed SVCS.yaml → services.yaml.
          </p>
        </section>
      </main>

      <footer className="lp-foot">
        <span className="lp-foot-mark">ENDR</span>
        <span className="lp-foot-mid">Technical reference · commit a107f97</span>
        <a
          className="lp-foot-link"
          href="https://github.com/calavelas/ENDR"
          target="_blank"
          rel="noreferrer"
        >
          <Icon.Github size={14} />
          GitHub
          <Icon.ExternalLink size={12} />
        </a>
      </footer>
    </div>
  );
}
