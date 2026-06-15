export const dynamic = "force-dynamic";
export const revalidate = 0;

import {
  DashboardView,
  type ActivityItem,
  type MissionRow,
  type PlatformRow,
} from "../components/dashboard-view";
import {
  hasAttention,
  healthTone,
  loadSnapshot,
  resolveGithubRepoUrl,
  shortRevision,
  sortByName,
  syncTone,
  type NodeTone,
  type ServiceNode,
} from "../lib/platform";

// Map a discrete health status to a representative bar percentage for the demo.
function healthPercent(status: string): number {
  switch (status.trim().toLowerCase()) {
    case "healthy":
      return 100;
    case "progressing":
      return 65;
    case "degraded":
      return 45;
    case "suspended":
      return 25;
    case "missing":
      return 0;
    case "unknown":
      return 35;
    default:
      return 50;
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "—";
  }
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

function hostFromUrl(url: string, fallbackName: string): string {
  try {
    return new URL(url).host;
  } catch {
    return `${fallbackName}.calavelas.net`;
  }
}

function isWithinDays(iso: string | null, days: number): boolean {
  if (!iso) {
    return false;
  }
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return false;
  }
  return Date.now() - then < days * 24 * 60 * 60 * 1000;
}

function toMissionRow(service: ServiceNode): MissionRow {
  const endpoint = service.serviceUrl?.trim() || `https://${service.name}.calavelas.net`;
  return {
    name: service.name,
    status: service.healthStatus,
    tone: healthTone(service.healthStatus),
    template: service.templateName?.trim() || "—",
    namespace: service.namespace,
    endpoint,
    endpointHost: hostFromUrl(endpoint, service.name),
    healthPct: healthPercent(service.healthStatus),
    revision: shortRevision(service.revision),
    deployed: relativeTime(service.deployedAt),
    href: `/application-services/${encodeURIComponent(service.name)}`,
    attention: hasAttention(service),
  };
}

export default async function DashboardPage() {
  const snapshot = await loadSnapshot();
  const githubUrl = resolveGithubRepoUrl();

  const serviceApps = sortByName(snapshot.services);
  const rows = serviceApps.map(toMissionRow);

  const total = serviceApps.length;
  const healthy = serviceApps.filter(
    (service) => healthTone(service.healthStatus) === "good" && syncTone(service.syncStatus) === "good",
  ).length;
  const healthyPct = total > 0 ? Math.round((healthy / total) * 1000) / 10 : 0;

  const allNodes = [...snapshot.services, ...snapshot.platformServices];
  const deployments = allNodes.filter((node) => isWithinDays(node.deployedAt, 7)).length;

  const stats = {
    servicesActive: total,
    healthy,
    healthyPct,
    deployments,
  };

  // Platform Status panel: one card per real platform service, attention first.
  const toneRank: Record<NodeTone, number> = { bad: 0, warn: 1, neutral: 2, good: 3 };
  const platform: PlatformRow[] = snapshot.platformServices
    .map((node) => ({
      name: node.name,
      status: node.healthStatus,
      tone: healthTone(node.healthStatus),
    }))
    .sort((a, b) => toneRank[a.tone] - toneRank[b.tone] || a.name.localeCompare(b.name));

  const activity: ActivityItem[] = allNodes
    .filter((node) => node.deployedAt && !Number.isNaN(new Date(node.deployedAt).getTime()))
    .sort((a, b) => new Date(b.deployedAt as string).getTime() - new Date(a.deployedAt as string).getTime())
    .slice(0, 6)
    .map((node) => {
      const bad = healthTone(node.healthStatus) === "bad";
      return {
        tone: bad ? "bad" : "good",
        title: bad ? `${node.name} deployment degraded` : `${node.name} deployment successful`,
        sub: bad ? "Readiness checks failed" : `Revision ${shortRevision(node.revision)}`,
        time: relativeTime(node.deployedAt),
      };
    });

  return (
    <DashboardView
      stats={stats}
      rows={rows}
      platform={platform}
      activity={activity}
      githubUrl={githubUrl}
    />
  );
}
