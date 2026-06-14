export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import * as Icon from "../../components/icons";
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

      {justCreated ? (
        <aside className="mc-explain idp" role="status">
          <span className="mc-explain-mark" aria-hidden="true">
            ✓
          </span>
          <div className="mc-explain-body">
            <p>
              <b>Service requested.</b>{" "}
              {pr ? (
                <>
                  Pull request <b>#{pr}</b> is open.
                </>
              ) : (
                "A pull request is open."
              )}{" "}
              CI validates and merges it, then ArgoCD deploys it — this page tracks the rollout live.
              It&apos;s safe to refresh or bookmark.
            </p>
          </div>
        </aside>
      ) : justDecommissioned ? (
        <aside className="mc-explain idp" role="status">
          <span className="mc-explain-mark" aria-hidden="true">
            ⚠
          </span>
          <div className="mc-explain-body">
            <p>
              <b>Decommission requested.</b>{" "}
              {pr ? (
                <>
                  Pull request <b>#{pr}</b> is open.
                </>
              ) : (
                "A pull request is open."
              )}{" "}
              On merge, reconcile removes its config and ArgoCD prunes the workload from the cluster.
              This page tracks it live.
            </p>
          </div>
        </aside>
      ) : null}

      <ServiceHistoryPanel serviceName={decodedServiceName} />
    </div>
  );
}
