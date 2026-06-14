export const dynamic = "force-dynamic";
export const revalidate = 0;

import { ServiceDetailView } from "../../components/service-detail-view";
import { ServiceProvisioningView } from "../../components/service-provisioning-view";
import {
  buildArgoApplicationUrl,
  buildGithubFileUrl,
  buildGithubFolderUrl,
  buildGithubRawFileUrl,
  buildServiceFolderPath,
  findServiceByName,
  loadDecommissionEligibility,
  loadServiceArgoDetail,
  loadSnapshot,
  resolveArgoEmbedUrl,
  resolveGithubBranch,
  resolveGithubRepoUrl,
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
    // Not live yet. Never hard-404 a service route: a just-created service isn't in
    // the catalog for ~30-60s (until its PR merges), then it provisions, then it goes
    // live. Show a friendly auto-refreshing state across that whole window instead of
    // a bare 404 (which reads as "I broke it"). In-catalog -> provisioning (+ teardown);
    // not-yet-in-catalog -> "being created" pending copy.
    const eligibility = await loadDecommissionEligibility(serviceName);
    const inCatalog = eligibility.decommissionable || eligibility.protected;
    const provisioningArgoUrl = buildArgoApplicationUrl(resolveArgoEmbedUrl(), "services");
    const host = `${serviceName}.calavelas.net`;
    return (
      <ServiceProvisioningView
        name={serviceName}
        argoUrl={provisioningArgoUrl}
        accessHost={host}
        accessUrl={`https://${host}`}
        decommissionable={eligibility.decommissionable}
        decommissionReason={eligibility.reason}
        protectedUnit={eligibility.protected}
        pending={!inCatalog}
      />
    );
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
  const argoDetail = await loadServiceArgoDetail(service.name);
  const decommission = await loadDecommissionEligibility(service.name);

  let serviceReadmeContent = "";
  let serviceReadmeError = "";
  try {
    const response = await fetch(serviceReadmeRawUrl, { cache: "no-store" });
    if (!response.ok) {
      serviceReadmeError =
        response.status === 404
          ? "README.md not found for this service."
          : `Unable to load README.md (HTTP ${response.status}).`;
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

  return (
    <ServiceDetailView
      kind="application"
      name={service.name}
      namespace={service.namespace}
      healthStatus={service.healthStatus}
      syncStatus={service.syncStatus}
      imageTag={service.imageTag}
      revision={service.revision}
      deployedAt={service.deployedAt}
      sourcePath={service.sourcePath}
      accessHost={serviceAccessHost}
      accessUrl={serviceAccessUrl}
      githubFolderUrl={serviceGithubUrl}
      readme={{
        path: serviceReadmePath,
        githubUrl: serviceReadmeGithubUrl,
        content: serviceReadmeContent,
        error: serviceReadmeError,
      }}
      argoUrl={serviceArgoUrl}
      argoDetail={argoDetail}
      decommissionable={decommission.decommissionable}
      decommissionReason={decommission.reason}
      protectedUnit={decommission.protected}
      warnings={snapshot.warnings}
    />
  );
}
