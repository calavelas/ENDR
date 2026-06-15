export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";

import { ServiceDetailView } from "../../components/service-detail-view";
import {
  buildArgoApplicationUrl,
  buildGithubFolderUrl,
  findPlatformServiceByName,
  loadServiceArgoDetail,
  loadSnapshot,
  resolveArgoEmbedUrl,
  resolveGithubBranch,
  resolveGithubRepoUrl,
} from "../../lib/platform";

interface PlatformServiceDetailPageProps {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return { title: `${name} — ENDR` };
}

export default async function PlatformServiceDetailPage({ params }: PlatformServiceDetailPageProps) {
  const { name } = await params;

  const snapshot = await loadSnapshot();
  const appName = decodeURIComponent(name);
  const platformService = findPlatformServiceByName(snapshot.platformServices, appName);

  if (!platformService) {
    notFound();
  }

  const embedUrl = resolveArgoEmbedUrl();
  const githubRepoUrl = resolveGithubRepoUrl();
  const githubBranch = resolveGithubBranch();
  const appArgoUrl = buildArgoApplicationUrl(embedUrl, platformService.name);
  const appGithubUrl = platformService.sourcePath
    ? buildGithubFolderUrl(githubRepoUrl, githubBranch, platformService.sourcePath)
    : null;
  const argoDetail = await loadServiceArgoDetail(platformService.name);

  return (
    <ServiceDetailView
      kind="platform"
      name={platformService.name}
      namespace={platformService.namespace}
      healthStatus={platformService.healthStatus}
      syncStatus={platformService.syncStatus}
      imageTag={platformService.imageTag}
      revision={platformService.revision}
      deployedAt={platformService.deployedAt}
      sourcePath={platformService.sourcePath}
      githubFolderUrl={appGithubUrl}
      argoUrl={appArgoUrl}
      argoDetail={argoDetail}
      warnings={snapshot.warnings}
    />
  );
}
