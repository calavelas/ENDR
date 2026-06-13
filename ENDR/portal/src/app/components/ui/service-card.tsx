import Link from "next/link";

import type { ServiceNode } from "../../lib/platform";
import { StatusPill } from "./status-pill";

export function ServiceCard({
  service,
  href,
  showGateway = false,
}: {
  service: ServiceNode;
  href: string;
  showGateway?: boolean;
}) {
  const gatewayEnabled = service.gatewayEnabled === true;
  const serviceUrl = service.serviceUrl?.trim() || `https://${service.name}.calavelas.net`;

  return (
    <div className="service-card">
      <div className="service-card-head">
        <Link href={href} className="service-card-name">
          {service.name}
        </Link>
        <span className="chip muted">{service.namespace}</span>
      </div>
      <div className="service-card-status">
        <StatusPill status={service.healthStatus} kind="health" />
        <StatusPill status={service.syncStatus} kind="sync" />
      </div>
      <div className="service-card-meta">
        <span className="service-card-meta-item">
          <span className="k">image</span>
          <code>{service.imageTag ?? "n/a"}</code>
        </span>
        {showGateway && gatewayEnabled ? (
          <a className="entity-link" href={serviceUrl} target="_blank" rel="noreferrer">
            open ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}
