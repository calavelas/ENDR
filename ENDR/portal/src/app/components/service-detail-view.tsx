"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { environmentLabel, platformServiceLabel, useNarrative } from "../lib/narrative";
import {
  healthTone,
  optionalTimestamp,
  shortRevision,
  syncTone,
  type NodeTone,
  type ServiceArgoDetail,
} from "../lib/platform";
import { ArgoEmbedPanel } from "./argo-embed-panel";
import { ServiceDeliveryPanel } from "./service-delivery-panel";
import * as Icon from "./icons";
import { ServiceFilesTab } from "./service-files-tab";

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
  argoDetail?: ServiceArgoDetail | null;
  decommissionable?: boolean;
  decommissionReason?: string;
  protectedUnit?: boolean;
  warnings: string[];
}

// Decommission (destroy) control. Active only for portal-managed, non-protected
// services; greyed out (with a reason) for core platform apps and protected
// robots like TARS/CASE. Confirm -> opens a removal PR (auto-merged) -> reconcile
// prunes the chart + ArgoCD app.
export function DecommissionButton({
  name,
  decommissionable,
  reason,
}: {
  name: string;
  decommissionable: boolean;
  reason?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!decommissionable) {
    return (
      <button
        type="button"
        className="mc-btn mc-btn-sm mc-btn-soft"
        disabled
        title={reason ? `Protected — ${reason}` : "Protected — cannot be decommissioned"}
      >
        <Icon.AlertTriangle size={14} />
        Decommission
      </button>
    );
  }

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/platform/services/${encodeURIComponent(name)}/decommission`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = (await res.json().catch(() => ({}))) as { detail?: string; pullRequestNumber?: number };
      if (!res.ok) {
        throw new Error(typeof body.detail === "string" ? body.detail : `HTTP ${res.status}`);
      }
      const pr = body.pullRequestNumber ? `&pr=${body.pullRequestNumber}` : "";
      router.replace(`/history/${encodeURIComponent(name)}?decommissioned=1${pr}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "decommission failed");
      setBusy(false);
    }
  };

  if (confirming) {
    return (
      <span className="mc-confirm">
        <span className="mc-confirm-q">
          Decommission <b>{name}</b>?
        </span>
        <button type="button" className="mc-btn mc-btn-sm mc-btn-danger" onClick={() => void run()} disabled={busy}>
          {busy ? "Opening PR…" : "Confirm"}
        </button>
        <button type="button" className="mc-btn mc-btn-sm mc-btn-soft" onClick={() => setConfirming(false)} disabled={busy}>
          Cancel
        </button>
        {error ? (
          <span className="form-error" role="alert">
            {error}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <button type="button" className="mc-btn mc-btn-sm mc-btn-danger" onClick={() => setConfirming(true)}>
      <Icon.AlertTriangle size={14} />
      Decommission
    </button>
  );
}

// "Kanin Kongchatree <a@b.com>" -> "Kanin Kongchatree".
function authorName(author: string): string {
  return author.replace(/\s*<[^>]*>\s*$/, "").trim() || author;
}

function firstLine(message: string): string {
  return message.split("\n")[0].trim();
}

function Badge({ status, tone }: { status: string; tone: NodeTone }) {
  return (
    <span className={`mc-badge ${tone}`}>
      <span className="mc-badge-dot" />
      {status}
    </span>
  );
}

type TabId = "overview" | "readme" | "files" | "argocd";

export function ServiceDetailView(props: ServiceDetailViewProps) {
  const { mode, t } = useNarrative();
  const hasReadme = props.kind === "application" && !!props.readme;
  const [tab, setTab] = useState<TabId>("overview");

  const argo = props.argoDetail ?? null;
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
      <Link href="/catalog" className="mc-back">
        <Icon.ChevronLeft size={15} />
        {mode === "interstellar" ? "Back to fleet" : "Back to catalog"}
      </Link>

      <section className="mc-panel mc-detail-hero">
        <span className="mc-detail-sub">{kindLabel}</span>
        <h1 className="mc-detail-hero-title">{displayName}</h1>
        <p className="mc-detail-hero-copy">
          {mode === "interstellar" ? (
            <>
              This is a <b>live {kindLabel}</b> on station. You don&apos;t crack open a running unit — to
              recalibrate it you edit its <b>deployment config</b>, open a pull request, and the autopilot
              rolls out the change.
            </>
          ) : (
            <>
              This is a <b>live {kindLabel}</b> in the cluster. You don&apos;t SSH into the pod — to change
              it you edit its generated <b>GitOps config</b>
              {props.sourcePath ? (
                <>
                  {" "}
                  (<code>{props.sourcePath}</code>)
                </>
              ) : null}
              , open a pull request, and ArgoCD rolls out the change.
            </>
          )}
        </p>
        <div className="mc-detail-hero-meta">
          <Badge status={props.healthStatus} tone={healthT} />
          <Badge status={props.syncStatus} tone={syncT} />
          <span className="mc-chip">
            <span className="mc-chip-key">{t.namespaceLabel}</span>
            {environmentLabel(props.namespace, mode)}
          </span>
          <span className="mc-chip mc-mono">{props.imageTag ?? "n/a"}</span>
          {props.githubFolderUrl || props.argoUrl || props.kind === "application" ? (
            <span className="mc-detail-hero-actions">
              {props.githubFolderUrl ? (
                <a className="mc-btn mc-btn-sm mc-btn-soft" href={props.githubFolderUrl} target="_blank" rel="noreferrer">
                  <Icon.Github size={14} />
                  GitHub
                </a>
              ) : null}
              {props.argoUrl ? (
                <a className="mc-btn mc-btn-sm mc-btn-soft" href={props.argoUrl} target="_blank" rel="noreferrer">
                  Open in ArgoCD
                  <Icon.ExternalLink size={14} />
                </a>
              ) : null}
              {props.kind === "application" ? (
                <DecommissionButton
                  name={props.name}
                  decommissionable={props.decommissionable ?? false}
                  reason={props.decommissionReason}
                />
              ) : null}
            </span>
          ) : null}
        </div>
      </section>

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
        {props.kind === "application" ? (
          <button type="button" className={`mc-tab${tab === "files" ? " on" : ""}`} onClick={() => setTab("files")}>
            Files
          </button>
        ) : null}
        <button type="button" className={`mc-tab${tab === "argocd" ? " on" : ""}`} onClick={() => setTab("argocd")}>
          ArgoCD
        </button>
      </div>

      {tab === "overview" ? (
        <>
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
              {argo?.commit?.author ? (
                <>
                  <dt>Deployed by</dt>
                  <dd>{authorName(argo.commit.author)}</dd>
                </>
              ) : null}
              {argo?.healthMessage ? (
                <>
                  <dt>Reason</dt>
                  <dd>{argo.healthMessage}</dd>
                </>
              ) : null}
            </dl>
          </article>

          {argo?.available ? (
            <>
              <article className="mc-panel mc-detail-span">
                <div className="mc-panel-head">
                  <h2 className="mc-panel-title">Deployed commit</h2>
                </div>
                {argo.commit ? (
                  <dl className="mc-kv">
                    <dt>Commit</dt>
                    <dd className="mc-mono">{argo.commit.shortRevision ?? argo.commit.revision}</dd>
                    {argo.commit.author ? (
                      <>
                        <dt>Author</dt>
                        <dd>{authorName(argo.commit.author)}</dd>
                      </>
                    ) : null}
                    {argo.commit.date ? (
                      <>
                        <dt>When</dt>
                        <dd>{optionalTimestamp(argo.commit.date)}</dd>
                      </>
                    ) : null}
                    {argo.commit.message ? (
                      <>
                        <dt>Message</dt>
                        <dd>{firstLine(argo.commit.message)}</dd>
                      </>
                    ) : null}
                  </dl>
                ) : (
                  <p className="mc-muted">
                    No commit metadata for revision {argo.revision ? shortRevision(argo.revision) : "n/a"}.
                  </p>
                )}
                {argo.autoSync || argo.selfHeal || argo.prune ? (
                  <div className="mc-policy-row">
                    {argo.autoSync ? <span className="mc-policy">Auto-sync</span> : null}
                    {argo.selfHeal ? <span className="mc-policy">Self-heal</span> : null}
                    {argo.prune ? <span className="mc-policy">Prune</span> : null}
                  </div>
                ) : null}
                {argo.images.length ? (
                  <div className="mc-card-meta" style={{ marginTop: "0.7rem" }}>
                    {argo.images.map((image) => (
                      <span key={image} className="mc-chip mc-mono">
                        {image}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>

              <article className="mc-panel mc-detail-span" style={{ minWidth: 0 }}>
                <div className="mc-panel-head">
                  <h2 className="mc-panel-title">Live resources</h2>
                  {argo.podsReady ? <span className="mc-count-chip">pods {argo.podsReady}</span> : null}
                </div>
                {argo.resourceSummary ? (
                  <p className="mc-muted" style={{ marginTop: 0, fontSize: "0.8rem" }}>
                    {argo.resourceSummary}
                  </p>
                ) : null}
                {argo.resources.length ? (
                  <div className="mc-table-wrap">
                    <table className="mc-table">
                      <thead>
                        <tr>
                          <th>Kind</th>
                          <th>Name</th>
                          <th>Status</th>
                          <th>Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {argo.resources.map((resource, index) => (
                          <tr key={`${resource.kind}-${resource.name}-${index}`}>
                            <td>
                              <span className="mc-res-kind">{resource.kind}</span>
                            </td>
                            <td className="mc-mono">{resource.name}</td>
                            <td>
                              <span className={`mc-badge ${healthTone(resource.health ?? "")}`}>
                                <span className="mc-badge-dot" />
                                {resource.ready ?? resource.health ?? "—"}
                                {typeof resource.restarts === "number" && resource.restarts > 0
                                  ? ` · ${resource.restarts}↺`
                                  : ""}
                              </span>
                            </td>
                            <td className="mc-res-msg">{resource.healthMessage ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mc-empty">No resources reported.</p>
                )}
              </article>
            </>
          ) : null}

          {props.kind === "application" ? <ServiceDeliveryPanel serviceName={props.name} /> : null}
        </div>

        {argo?.available && argo.conditions.length ? (
          <section className="mc-warning" aria-live="polite">
            <strong>ArgoCD conditions</strong>
            <ul>
              {argo.conditions.map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
          </section>
        ) : null}
        </>
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

      {tab === "files" && props.kind === "application" ? (
        <ServiceFilesTab
          serviceName={props.name}
          thing={kindLabel}
          argoUrl={props.argoUrl}
          accessUrl={props.accessUrl ?? null}
          protectedUnit={props.protectedUnit ?? false}
        />
      ) : null}

      {tab === "argocd" ? (
        <section className="mc-panel mc-argo-embed-panel" style={{ minWidth: 0 }} aria-label="live-argocd">
          <div className="mc-panel-head">
            <h2 className="mc-panel-title">Live ArgoCD</h2>
            {props.argoUrl ? (
              <a className="mc-link-all" href={props.argoUrl} target="_blank" rel="noreferrer">
                Open ArgoCD
              </a>
            ) : null}
          </div>
          {props.argoUrl ? (
            <ArgoEmbedPanel embedUrl={props.argoUrl} />
          ) : (
            <p className="mc-empty">Live ArgoCD is not available in this environment.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
