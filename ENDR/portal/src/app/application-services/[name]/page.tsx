export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ArgoEmbedPanel } from "../../components/argo-embed-panel";
import { PortalFrame } from "../../components/portal-frame";
import { LinkButton } from "../../components/ui/button";
import { PageHeader } from "../../components/ui/page-header";
import { StatusPill } from "../../components/ui/status-pill";
import { Tabs } from "../../components/ui/tabs";
import {
  buildArgoApplicationUrl,
  buildGithubFileUrl,
  buildGithubFolderUrl,
  buildGithubRawFileUrl,
  buildServiceFolderPath,
  findServiceByName,
  loadSnapshot,
  optionalTimestamp,
  resolveArgoEmbedUrl,
  resolveGithubBranch,
  resolveGithubRepoUrl,
  shortRevision
} from "../../lib/platform";

interface ServiceDetailPageProps {
  params: Promise<{ name: string }>;
}

export default async function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const { name } = await params;

  const snapshot = await loadSnapshot();
  const serviceName = decodeURIComponent(name);
  const service = findServiceByName(snapshot.services, serviceName);

  if (!service) {
    notFound();
  }

  const embedUrl = resolveArgoEmbedUrl();
  const githubRepoUrl = resolveGithubRepoUrl();
  const githubBranch = resolveGithubBranch();
  const serviceArgoUrl = buildArgoApplicationUrl(embedUrl, service.name);
  const serviceFolder = buildServiceFolderPath(service.name);
  const serviceGithubUrl = buildGithubFolderUrl(githubRepoUrl, githubBranch, serviceFolder);
  const serviceReadmePath = `${serviceFolder}/README.md`;
  const serviceReadmeGithubUrl = buildGithubFileUrl(githubRepoUrl, githubBranch, serviceReadmePath);
  const serviceReadmeRawUrl = buildGithubRawFileUrl(githubRepoUrl, githubBranch, serviceReadmePath);
  const serviceAccessHost = `${service.name}.calavelas.net`;
  const serviceAccessUrl = `https://${serviceAccessHost}`;

  let serviceReadmeContent = "";
  let serviceReadmeError = "";
  try {
    const response = await fetch(serviceReadmeRawUrl, { cache: "no-store" });
    if (!response.ok) {
      serviceReadmeError =
        response.status === 404 ? "README.md not found for this service." : `Unable to load README.md (HTTP ${response.status}).`;
    } else {
      serviceReadmeContent = await response.text();
      if (!serviceReadmeContent.trim()) {
        serviceReadmeError = "README.md is empty for this service.";
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    serviceReadmeError = `Unable to load README.md: ${detail}`;
  }

  const overview = (
    <div className="detail-grid">
      <article className="panel detail-panel">
        <h2 className="panel-title">Identity</h2>
        <dl className="kv-list">
          <div>
            <dt>Kind</dt>
            <dd>application service</dd>
          </div>
          <div>
            <dt>Namespace</dt>
            <dd>{service.namespace}</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>
              <a className="entity-link" href={serviceAccessUrl} target="_blank" rel="noreferrer">
                {serviceAccessHost}
              </a>
            </dd>
          </div>
          <div>
            <dt>Source Path</dt>
            <dd>
              <code>{service.sourcePath}</code>
            </dd>
          </div>
          <div>
            <dt>GitHub</dt>
            <dd>
              <a className="entity-link" href={serviceGithubUrl} target="_blank" rel="noreferrer">
                Open folder
              </a>
            </dd>
          </div>
        </dl>
      </article>

      <article className="panel detail-panel">
        <h2 className="panel-title">Deployment</h2>
        <dl className="kv-list">
          <div>
            <dt>Health</dt>
            <dd>
              <StatusPill status={service.healthStatus} kind="health" />
            </dd>
          </div>
          <div>
            <dt>Sync</dt>
            <dd>
              <StatusPill status={service.syncStatus} kind="sync" />
            </dd>
          </div>
          <div>
            <dt>Image</dt>
            <dd>
              <code>{service.imageTag ?? "n/a"}</code>
            </dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd>
              <code>{shortRevision(service.revision)}</code>
            </dd>
          </div>
          <div>
            <dt>Deployed</dt>
            <dd>{optionalTimestamp(service.deployedAt)}</dd>
          </div>
        </dl>
      </article>
    </div>
  );

  const readme = (
    <section className="panel detail-panel readme-panel" aria-label="service-readme">
      <p className="embed-note">
        Loaded from{" "}
        <a className="entity-link" href={serviceReadmeGithubUrl} target="_blank" rel="noreferrer">
          {serviceReadmePath}
        </a>
        .
      </p>
      {serviceReadmeError ? (
        <p className="form-error" role="alert">
          {serviceReadmeError}
        </p>
      ) : (
        <div className="service-readme-content markdown-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{serviceReadmeContent}</ReactMarkdown>
        </div>
      )}
    </section>
  );

  const argocd = serviceArgoUrl ? (
    <ArgoEmbedPanel embedUrl={serviceArgoUrl} />
  ) : (
    <p className="empty-cell">Live ArgoCD is not available in this environment.</p>
  );

  return (
    <PortalFrame snapshot={snapshot}>
      <section className="portal-main">
        <PageHeader
          title={service.name}
          subtitle="Application service"
          actions={
            serviceArgoUrl ? (
              <LinkButton href={serviceArgoUrl} external>
                Open in ArgoCD
              </LinkButton>
            ) : undefined
          }
        />

        <div className="detail-status-strip">
          <StatusPill status={service.healthStatus} kind="health" />
          <StatusPill status={service.syncStatus} kind="sync" />
          <span className="chip muted">{service.namespace}</span>
          <span className="chip muted">image {service.imageTag ?? "n/a"}</span>
        </div>

        {snapshot.warnings.length > 0 && (
          <section className="warning-box" aria-live="polite">
            <h2>Warnings</h2>
            <ul>
              {snapshot.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        )}

        <Tabs
          tabs={[
            { id: "overview", label: "Overview", content: overview },
            { id: "readme", label: "README", content: readme },
            { id: "argocd", label: "ArgoCD", content: argocd }
          ]}
        />

        <p>
          <Link className="entity-link" href="/catalog">
            ← Back to Catalog
          </Link>
        </p>
      </section>
    </PortalFrame>
  );
}
