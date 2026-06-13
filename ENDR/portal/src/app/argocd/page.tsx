export const dynamic = "force-dynamic";
export const revalidate = 0;

import { ArgoEmbedPanel } from "../components/argo-embed-panel";
import { loadSnapshot, resolveArgoEmbedUrl } from "../lib/platform";

export default async function ArgoCdPage() {
  const snapshot = await loadSnapshot();
  const embedUrl = resolveArgoEmbedUrl();

  return (
    <>
      <section className="portal-main">
        <section className="hero-row">
          <div>
            <p className="eyebrow">ArgoCD</p>
            <h1>Embedded ArgoCD</h1>
            <p className="hero-subtitle">Read-only embedded operational view.</p>
          </div>
          <a className="open-link" href={embedUrl} target="_blank" rel="noreferrer">
            Open ArgoCD
          </a>
        </section>

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

        <ArgoEmbedPanel embedUrl={embedUrl} linkOnly />
      </section>
    </>
  );
}
