export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";

import { ServiceDetailView } from "../../components/service-detail-view";
import {
  buildArgoApplicationUrl,
  buildGithubFileUrl,
  buildGithubFolderUrl,
  buildGithubRawFileUrl,
  buildServiceFolderPath,
  findServiceByName,
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
    notFound();
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
      warnings={snapshot.warnings}
    />
  );
}
