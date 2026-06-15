export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Service Catalog — ENDR" };

import { CatalogExplorer } from "../components/catalog-explorer";
import { loadSnapshot, resolveArgoEmbedUrl, resolveGithubBranch, resolveGithubRepoUrl } from "../lib/platform";

export default async function CatalogPage() {
  const snapshot = await loadSnapshot();
  const embedUrl = resolveArgoEmbedUrl();
  const githubRepoUrl = resolveGithubRepoUrl();
  const githubBranch = resolveGithubBranch();

  return (
    <div className="mc">
      {snapshot.warnings.length > 0 && (
        <section className="mc-warning" aria-live="polite">
          <strong>Warnings</strong>
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
    </div>
  );
}
