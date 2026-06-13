export const dynamic = "force-dynamic";
export const revalidate = 0;

import { ArgoEmbedPanel } from "./components/argo-embed-panel";
import { PortalFrame } from "./components/portal-frame";
import { LinkButton } from "./components/ui/button";
import { PageHeader } from "./components/ui/page-header";
import { ServiceCard } from "./components/ui/service-card";
import { StatCard } from "./components/ui/stat-card";
import {
  dataSourceTone,
  hasAttention,
  healthTone,
  loadSnapshot,
  resolveArgoEmbedUrl,
  resolveGithubRepoUrl,
  sortByName,
  syncTone
} from "./lib/platform";

export default async function HomePage() {
  const snapshot = await loadSnapshot();
  const embedUrl = resolveArgoEmbedUrl();
  const githubRepoUrl = resolveGithubRepoUrl();

  const serviceApps = sortByName(snapshot.services);
  const platformApps = sortByName(snapshot.platformServices);

  const healthy = serviceApps.filter(
    (service) => healthTone(service.healthStatus) === "good" && syncTone(service.syncStatus) === "good"
  ).length;
  const attention = serviceApps.filter(hasAttention).length;

  return (
    <PortalFrame snapshot={snapshot}>
      <section className="portal-main">
        <PageHeader
          title="Internal Developer Platform"
          subtitle="Create, deploy, and observe services through GitHub and ArgoCD — no kubectl required."
          actions={
            <>
              <LinkButton href="/create">Create service</LinkButton>
              <LinkButton href={githubRepoUrl} variant="ghost" external>
                View source
              </LinkButton>
            </>
          }
        />

        <div className="stat-grid">
          <StatCard label="Application services" value={serviceApps.length} />
          <StatCard
            label="Healthy"
            value={healthy}
            tone={serviceApps.length > 0 && healthy === serviceApps.length ? "good" : "neutral"}
          />
          <StatCard label="Need attention" value={attention} tone={attention > 0 ? "bad" : "good"} />
          <StatCard
            label="Data source"
            value={snapshot.dataSource}
            tone={dataSourceTone(snapshot.dataSource)}
            hint={`cluster ${snapshot.clusterName}`}
          />
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

        <section className="section-block">
          <div className="section-head">
            <h2>Application Services</h2>
            <span className="chip muted">{serviceApps.length}</span>
          </div>
          {serviceApps.length === 0 ? (
            <p className="empty-cell">No application services yet. Create one to get started.</p>
          ) : (
            <div className="service-grid">
              {serviceApps.map((service) => (
                <ServiceCard
                  key={service.name}
                  service={service}
                  href={`/application-services/${encodeURIComponent(service.name)}`}
                  showGateway
                />
              ))}
            </div>
          )}
        </section>

        <section className="section-block">
          <div className="section-head">
            <h2>Platform Services</h2>
            <span className="chip muted">{platformApps.length}</span>
          </div>
          {platformApps.length === 0 ? (
            <p className="empty-cell">No platform services found.</p>
          ) : (
            <div className="service-grid">
              {platformApps.map((app) => (
                <ServiceCard
                  key={app.name}
                  service={app}
                  href={`/platform-services/${encodeURIComponent(app.name)}`}
                />
              ))}
            </div>
          )}
        </section>

        <section className="section-block">
          <div className="section-head">
            <h2>ArgoCD Dashboard</h2>
          </div>
          <ArgoEmbedPanel embedUrl={embedUrl} showHeader={false} linkOnly />
        </section>
      </section>
    </PortalFrame>
  );
}
