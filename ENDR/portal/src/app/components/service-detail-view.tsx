"use client";

import Link from "next/link";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { environmentLabel, platformServiceLabel, useNarrative } from "../lib/narrative";
import { healthTone, optionalTimestamp, shortRevision, syncTone, type NodeTone } from "../lib/platform";
import { ArgoEmbedPanel } from "./argo-embed-panel";
import { Explain } from "./explain";
import * as Icon from "./icons";
import { StageRail } from "./stage-rail";

export interface ReadmeData {
  path: string;
  githubUrl: string;
  content: string;
  error: string;
}

export interface ServiceDetailViewProps {
  kind: "application" | "platform";
  name: string;
  namespace: string;
  healthStatus: string;
  syncStatus: string;
  imageTag: string | null;
  revision: string;
  deployedAt: string | null;
  sourcePath: string | null;
  accessHost?: string | null;
  accessUrl?: string | null;
  githubFolderUrl?: string | null;
  readme?: ReadmeData | null;
  argoUrl: string;
  warnings: string[];
}

function Badge({ status, tone }: { status: string; tone: NodeTone }) {
  return (
    <span className={`mc-badge ${tone}`}>
      <span className="mc-badge-dot" />
      {status}
    </span>
  );
}

// A static read of the ArgoCD reconcile→sync→healthy loop reflecting the
// service's current state — the mockup's provisioning pipeline as live status.
function SyncPipeline({ sync, health }: { sync: NodeTone; health: NodeTone }) {
  const cls = (tone: NodeTone) => (tone === "good" ? "done" : tone === "warn" ? "run" : "");
  return (
    <div className="mc-pipe">
      <div className="mc-stage done">
        <span className="mc-stage-dot">1</span>
        <div>
          <h4 className="mc-stage-title">Reconcile &amp; render</h4>
          <p className="mc-stage-meta">engine → chart + ArgoCD app</p>
        </div>
      </div>
      <div className={`mc-stage ${cls(sync)}`}>
        <span className="mc-stage-dot">2</span>
        <div>
          <h4 className="mc-stage-title">ArgoCD sync</h4>
          <p className="mc-stage-meta">deployment · service · httproute</p>
        </div>
      </div>
      <div className={`mc-stage ${cls(health)}`}>
        <span className="mc-stage-dot">3</span>
        <div>
          <h4 className="mc-stage-title">Healthy</h4>
          <p className="mc-stage-meta">pod ready · route live</p>
        </div>
      </div>
    </div>
  );
}

type TabId = "overview" | "readme" | "argocd";

export function ServiceDetailView(props: ServiceDetailViewProps) {
  const { mode, t } = useNarrative();
  const hasReadme = props.kind === "application" && !!props.readme;
  const [tab, setTab] = useState<TabId>("overview");

  const healthT = healthTone(props.healthStatus);
  const syncT = syncTone(props.syncStatus);
  const kindLabel =
    props.kind === "application"
      ? mode === "interstellar"
        ? "robot"
        : "application service"
      : mode === "interstellar"
        ? "subsystem"
        : "platform service";
  const displayName =
    props.kind === "platform" ? platformServiceLabel(props.name, mode) : props.name;

  return (
    <div className="mc">
      <StageRail active="operate" />

      <Link href="/catalog" className="mc-back">
        <Icon.ChevronLeft size={15} />
        {mode === "interstellar" ? "Back to fleet" : "Back to catalog"}
      </Link>

      <div className="mc-status-strip">
        <Badge status={props.healthStatus} tone={healthT} />
        <Badge status={props.syncStatus} tone={syncT} />
        <span className="mc-chip">
          <span className="mc-chip-key">{t.namespaceLabel}</span>
          {environmentLabel(props.namespace, mode)}
        </span>
        <span className="mc-chip mc-mono">{props.imageTag ?? "n/a"}</span>
        {props.argoUrl ? (
          <a className="mc-extlink" href={props.argoUrl} target="_blank" rel="noreferrer" style={{ marginLeft: "auto" }}>
            Open in ArgoCD
            <Icon.ExternalLink size={13} />
          </a>
        ) : null}
      </div>

      <Explain
        idp={
          <>
            This is a <b>live {kindLabel}</b> in the cluster. You don't SSH into the pod — to change
            it you edit its generated <b>GitOps config</b>
            {props.sourcePath ? (
              <>
                {" "}
                (<code>{props.sourcePath}</code>)
              </>
            ) : null}
            , open a pull request, and ArgoCD rolls out the change.
          </>
        }
        interstellar={
          <>
            This is a <b>live {kindLabel}</b> on station. You don't crack open a running unit — to
            recalibrate it you edit its <b>deployment config</b>, open a pull request, and the
            autopilot rolls out the change.
          </>
        }
      />

      {props.warnings.length > 0 && (
        <section className="mc-warning" aria-live="polite">
          <strong>Warnings</strong>
          <ul>
            {props.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="mc-tabs" role="tablist">
        <button type="button" className={`mc-tab${tab === "overview" ? " on" : ""}`} onClick={() => setTab("overview")}>
          Overview
        </button>
        {hasReadme ? (
          <button type="button" className={`mc-tab${tab === "readme" ? " on" : ""}`} onClick={() => setTab("readme")}>
            README
          </button>
        ) : null}
        <button type="button" className={`mc-tab${tab === "argocd" ? " on" : ""}`} onClick={() => setTab("argocd")}>
          ArgoCD
        </button>
      </div>

      {tab === "overview" ? (
        <div className="mc-detail-grid">
          <article className="mc-panel">
            <div className="mc-panel-head">
              <h2 className="mc-panel-title">Identity</h2>
            </div>
            <dl className="mc-kv">
              <dt>Kind</dt>
              <dd>{kindLabel}</dd>
              <dt>{t.namespaceLabel}</dt>
              <dd>{environmentLabel(props.namespace, mode)}</dd>
              {props.accessHost ? (
                <>
                  <dt>Access</dt>
                  <dd>
                    <a className="mc-extlink" href={props.accessUrl ?? "#"} target="_blank" rel="noreferrer">
                      {props.accessHost}
                    </a>
                  </dd>
                </>
              ) : null}
              <dt>Source path</dt>
              <dd className="mc-mono">{props.sourcePath || "n/a"}</dd>
              <dt>GitHub</dt>
              <dd>
                {props.githubFolderUrl ? (
                  <a className="mc-extlink" href={props.githubFolderUrl} target="_blank" rel="noreferrer">
                    Open folder
                  </a>
                ) : (
                  "n/a"
                )}
              </dd>
            </dl>
          </article>

          <article className="mc-panel">
            <div className="mc-panel-head">
              <h2 className="mc-panel-title">Deployment</h2>
            </div>
            <dl className="mc-kv">
              <dt>Health</dt>
              <dd>
                <Badge status={props.healthStatus} tone={healthT} />
              </dd>
              <dt>Sync</dt>
              <dd>
                <Badge status={props.syncStatus} tone={syncT} />
              </dd>
              <dt>Image</dt>
              <dd className="mc-mono">{props.imageTag ?? "n/a"}</dd>
              <dt>Revision</dt>
              <dd className="mc-mono">{shortRevision(props.revision)}</dd>
              <dt>Deployed</dt>
              <dd>{optionalTimestamp(props.deployedAt)}</dd>
            </dl>
          </article>
        </div>
      ) : null}

      {tab === "readme" && props.readme ? (
        <section className="mc-panel" aria-label="service-readme">
          <p className="mc-muted" style={{ fontSize: "0.82rem", marginTop: 0 }}>
            Loaded from{" "}
            <a className="mc-extlink" href={props.readme.githubUrl} target="_blank" rel="noreferrer">
              {props.readme.path}
            </a>
            .
          </p>
          {props.readme.error ? (
            <p className="mc-empty" role="alert">
              {props.readme.error}
            </p>
          ) : (
            <div className="markdown-preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{props.readme.content}</ReactMarkdown>
            </div>
          )}
        </section>
      ) : null}

      {tab === "argocd" ? (
        <div className="mc-detail-grid">
          <article className="mc-panel">
            <div className="mc-panel-head">
              <h2 className="mc-panel-title">Sync status</h2>
            </div>
            <SyncPipeline sync={syncT} health={healthT} />
          </article>
          <article className="mc-panel" style={{ minWidth: 0 }}>
            <div className="mc-panel-head">
              <h2 className="mc-panel-title">Live ArgoCD</h2>
            </div>
            {props.argoUrl ? (
              <ArgoEmbedPanel embedUrl={props.argoUrl} />
            ) : (
              <p className="mc-empty">Live ArgoCD is not available in this environment.</p>
            )}
          </article>
        </div>
      ) : null}
    </div>
  );
}
