export const dynamic = "force-dynamic";
export const revalidate = 0;

import { CatalogExplorer } from "../components/catalog-explorer";
import { LinkButton } from "../components/ui/button";
import { PageHeader } from "../components/ui/page-header";
import { loadSnapshot, resolveArgoEmbedUrl, resolveGithubBranch, resolveGithubRepoUrl } from "../lib/platform";

export default async function CatalogPage() {
  const snapshot = await loadSnapshot();
  const embedUrl = resolveArgoEmbedUrl();
  const githubRepoUrl = resolveGithubRepoUrl();
  const githubBranch = resolveGithubBranch();

  return (
    <>
      <section className="portal-main">
        <PageHeader
          title="Service Catalog"
          subtitle="Application and platform services across the cluster."
          actions={
            <>
              <LinkButton href="/create">Create service</LinkButton>
              {embedUrl ? (
                <LinkButton href={embedUrl} variant="ghost" external>
                  Open ArgoCD
                </LinkButton>
              ) : null}
            </>
          }
        />

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

        <CatalogExplorer
          services={snapshot.services}
          platformServices={snapshot.platformServices}
          embedUrl={embedUrl}
          githubRepoUrl={githubRepoUrl}
          githubBranch={githubBranch}
        />
      </section>
    </>
  );
}
