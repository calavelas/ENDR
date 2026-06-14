export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import * as Icon from "../../components/icons";
import {
  buildArgoApplicationUrl,
  resolveArgoEmbedUrl,
  resolveGithubRepoUrl,
} from "../../lib/platform";
import { ServiceHistoryPanel } from "./service-history-panel";

interface ServiceHistoryPageProps {
  params: Promise<{
    serviceName: string;
  }>;
  searchParams: Promise<{
    created?: string;
    decommissioned?: string;
    pr?: string;
  }>;
}

export default async function ServiceHistoryPage({ params, searchParams }: ServiceHistoryPageProps) {
  const { serviceName } = await params;
  const { created, decommissioned, pr } = await searchParams;
  const decodedServiceName = decodeURIComponent(serviceName);
  const justCreated = created === "1";
  const justDecommissioned = decommissioned === "1";
  const action = justDecommissioned ? "decommission" : justCreated ? "create" : null;

  // Build the PR link from the ?pr param directly — the history feed only indexes
  // "Adding service" PRs, so edit/decommission PRs won't appear there.
  const repoUrl = resolveGithubRepoUrl();
  const prUrl = pr && repoUrl ? `${repoUrl}/pull/${encodeURIComponent(pr)}` : null;
  const argoEmbedUrl = resolveArgoEmbedUrl();
  const argoUrl = buildArgoApplicationUrl(argoEmbedUrl, decodedServiceName);
  // The app-of-apps that owns every service's ArgoCD Application. On decommission,
  // the workflow deletes the service's file from the repo, but the child Application
  // is pruned by syncing THIS parent — so that's where the user needs to look.
  const argoAppsUrl = buildArgoApplicationUrl(argoEmbedUrl, "services");
  const servicePath = `/application-services/${encodeURIComponent(decodedServiceName)}`;
  const accessHost = `${decodedServiceName}.calavelas.net`;
  const accessUrl = `https://${accessHost}`;

  return (
    <div className="mc">
      <Link className="mc-back" href="/history">
        <Icon.ChevronLeft size={15} />
        Back to delivery
      </Link>

      <div className="mc-detail-head">
        <h1 className="mc-detail-title">{decodedServiceName}</h1>
        <span className="mc-detail-sub">Delivery history</span>
      </div>

      {action ? (
        <section className="mc-panel" aria-label="next steps">
          <div className="mc-panel-head">
            <h2 className="mc-panel-title">
              {action === "decommission" ? "Decommission requested" : "Service requested"}
            </h2>
            {pr ? (
              prUrl ? (
                <a className="mc-link-all" href={prUrl} target="_blank" rel="noreferrer">
                  PR #{pr} <Icon.ExternalLink size={13} />
                </a>
              ) : (
                <span className="mc-muted">PR #{pr}</span>
              )
            ) : null}
          </div>
          <p className="mc-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.84rem" }}>
            It ships as a pull request — here&apos;s how to see it through:
          </p>
          <ol className="mc-steps" aria-label="next steps">
            <li>
              <span className="mc-step-title">Check the pull request on GitHub</span>
              <p className="mc-step-body">CI validates it; portal PRs auto-merge once it&apos;s green.</p>
              {prUrl ? (
                <a className="mc-step-link" href={prUrl} target="_blank" rel="noreferrer">
                  Open PR #{pr} <Icon.ExternalLink size={12} />
                </a>
              ) : null}
            </li>
            {action === "decommission" ? (
              <li>
                <span className="mc-step-title">Sync the services app in ArgoCD</span>
                <p className="mc-step-body">
                  The merge deletes the service&apos;s file from the repo, but its running workload is
                  owned by the <b>services</b> app-of-apps. Reconcile regenerates the child Applications;
                  open <b>services</b> and hit <b>Refresh</b>, then <b>Sync</b> with <b>Prune</b> enabled to
                  remove this one&apos;s Application and tear the workload down.
                </p>
                {argoAppsUrl ? (
                  <a className="mc-step-link" href={argoAppsUrl} target="_blank" rel="noreferrer">
                    Open the services app-of-apps <Icon.ExternalLink size={12} />
                  </a>
                ) : null}
              </li>
            ) : (
              <li>
                <span className="mc-step-title">Check &amp; Sync in ArgoCD</span>
                <p className="mc-step-body">
                  After it merges, reconcile updates the manifests. Hit <b>Refresh</b>, then <b>Sync</b>, to roll it out now.
                </p>
                {argoUrl ? (
                  <a className="mc-step-link" href={argoUrl} target="_blank" rel="noreferrer">
                    Open in ArgoCD <Icon.ExternalLink size={12} />
                  </a>
                ) : null}
              </li>
            )}
            <li>
              <span className="mc-step-title">
                {action === "decommission" ? "Confirm it's gone" : "Open the service once it's generated"}
              </span>
              <p className="mc-step-body">
                {action === "decommission"
                  ? "Reconcile removes its chart + ArgoCD app and the workload is pruned — usually within a minute or two."
                  : "Reconcile renders its chart + ArgoCD app first, so give it a minute or two, then open the service page."}
              </p>
              {action === "create" ? (
                <Link className="mc-step-link" href={servicePath}>
                  Open service page <Icon.ChevronRight size={12} />
                </Link>
              ) : null}
            </li>
            {action === "create" ? (
              <li>
                <span className="mc-step-title">Visit the live service</span>
                <p className="mc-step-body">
                  Once it&apos;s deployed and synced, it serves at <code>{accessHost}</code>.
                </p>
                <a className="mc-step-link" href={accessUrl} target="_blank" rel="noreferrer">
                  Open {accessHost} <Icon.ExternalLink size={12} />
                </a>
              </li>
            ) : null}
          </ol>
        </section>
      ) : null}

      <ServiceHistoryPanel serviceName={decodedServiceName} />
    </div>
  );
}
