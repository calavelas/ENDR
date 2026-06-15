export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Observability — ENDR" };

import { ArgoEmbedPanel } from "../components/argo-embed-panel";
import { Explain } from "../components/explain";
import * as Icon from "../components/icons";
import { loadSnapshot, resolveArgoEmbedUrl } from "../lib/platform";

export default async function ArgoCdPage() {
  const snapshot = await loadSnapshot();
  const embedUrl = resolveArgoEmbedUrl();

  return (
    <div className="mc">
      {embedUrl ? (
        <div className="mc-page-actions">
          <a className="mc-btn mc-btn-soft" href={embedUrl} target="_blank" rel="noreferrer">
            Open ArgoCD
            <Icon.ExternalLink size={14} />
          </a>
        </div>
      ) : null}

      <Explain
        idp={
          <>
            <b>ArgoCD</b> continuously reconciles the repo (desired state) onto the cluster (actual
            state). This is the read-only operational view — what's synced, what's healthy, and what
            has drifted.
          </>
        }
        interstellar={
          <>
            The <b>autopilot</b> continuously reconciles the repo onto the cluster. This is deep-space
            telemetry — what's synced, what's healthy, and what has drifted.
          </>
        }
      />

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

      <ArgoEmbedPanel embedUrl={embedUrl} linkOnly />
    </div>
  );
}
