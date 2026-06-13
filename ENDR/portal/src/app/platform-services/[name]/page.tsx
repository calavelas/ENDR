export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";

import { ArgoEmbedPanel } from "../../components/argo-embed-panel";
import { LinkButton } from "../../components/ui/button";
import { PageHeader } from "../../components/ui/page-header";
import { StatusPill } from "../../components/ui/status-pill";
import { Tabs } from "../../components/ui/tabs";
import {
  buildArgoApplicationUrl,
  buildGithubFolderUrl,
  findPlatformServiceByName,
  loadSnapshot,
  optionalTimestamp,
  resolveArgoEmbedUrl,
  resolveGithubBranch,
  resolveGithubRepoUrl,
  shortRevision
} from "../../lib/platform";

interface PlatformServiceDetailPageProps {
  params: Promise<{ name: string }>;
}

export default async function PlatformServiceDetailPage({ params }: PlatformServiceDetailPageProps) {
  const { name } = await params;

  const snapshot = await loadSnapshot();
  const appName = decodeURIComponent(name);
  const platformService = findPlatformServiceByName(snapshot.platformServices, appName);

  if (!platformService) {
    notFound();
  }

  const embedUrl = resolveArgoEmbedUrl();
  const githubRepoUrl = resolveGithubRepoUrl();
  const githubBranch = resolveGithubBranch();
  const appArgoUrl = buildArgoApplicationUrl(embedUrl, platformService.name);
  const appGithubUrl = platformService.sourcePath
    ? buildGithubFolderUrl(githubRepoUrl, githubBranch, platformService.sourcePath)
    : null;

  const overview = (
    <div className="detail-grid">
      <article className="panel detail-panel">
        <h2 className="panel-title">Identity</h2>
        <dl className="kv-list">
          <div>
            <dt>Kind</dt>
            <dd>platform service</dd>
          </div>
          <div>
            <dt>Namespace</dt>
            <dd>{platformService.namespace}</dd>
          </div>
          <div>
            <dt>Source Path</dt>
            <dd>
              <code>{platformService.sourcePath || "n/a"}</code>
            </dd>
          </div>
          <div>
            <dt>GitHub</dt>
            <dd>
              {appGithubUrl ? (
                <a className="entity-link" href={appGithubUrl} target="_blank" rel="noreferrer">
                  Open folder
                </a>
              ) : (
                "n/a"
              )}
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
              <StatusPill status={platformService.healthStatus} kind="health" />
            </dd>
          </div>
          <div>
            <dt>Sync</dt>
            <dd>
              <StatusPill status={platformService.syncStatus} kind="sync" />
            </dd>
          </div>
          <div>
            <dt>Image</dt>
            <dd>
              <code>{platformService.imageTag ?? "n/a"}</code>
            </dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd>
              <code>{shortRevision(platformService.revision)}</code>
            </dd>
          </div>
          <div>
            <dt>Deployed</dt>
            <dd>{optionalTimestamp(platformService.deployedAt)}</dd>
          </div>
        </dl>
      </article>
    </div>
  );

  const argocd = appArgoUrl ? (
    <ArgoEmbedPanel embedUrl={appArgoUrl} />
  ) : (
    <p className="empty-cell">Live ArgoCD is not available in this environment.</p>
  );

  return (
    <>
      <section className="portal-main">
        <PageHeader
          title={platformService.name}
          subtitle="Platform service"
          actions={
            appArgoUrl ? (
              <LinkButton href={appArgoUrl} external>
                Open in ArgoCD
              </LinkButton>
            ) : undefined
          }
        />

        <div className="detail-status-strip">
          <StatusPill status={platformService.healthStatus} kind="health" />
          <StatusPill status={platformService.syncStatus} kind="sync" />
          <span className="chip muted">{platformService.namespace}</span>
          <span className="chip muted">image {platformService.imageTag ?? "n/a"}</span>
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
            { id: "argocd", label: "ArgoCD", content: argocd }
          ]}
        />

        <p>
          <Link className="entity-link" href="/catalog">
            ← Back to Catalog
          </Link>
        </p>
      </section>
    </>
  );
}
