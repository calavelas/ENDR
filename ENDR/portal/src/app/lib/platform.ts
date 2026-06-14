type NodeKind = "core" | "service";

export type NodeTone = "good" | "warn" | "bad" | "neutral";

export interface ServiceNode {
  name: string;
  kind: NodeKind;
  namespace: string;
  syncStatus: string;
  healthStatus: string;
  sourcePath: string;
  revision: string;
  deployedAt: string | null;
  imageTag: string | null;
  templateName?: string | null;
  gatewayEnabled?: boolean | null;
  serviceUrl?: string | null;
}

export interface PlatformSnapshot {
  generatedAt: string;
  dataSource: string;
  clusterName: string;
  clusterPath: string;
  servicesPath: string;
  warnings: string[];
  platformServices: ServiceNode[];
  services: ServiceNode[];
}

export interface ServiceArgoCommit {
  revision: string | null;
  shortRevision: string | null;
  author: string | null;
  date: string | null;
  message: string | null;
}

export interface ServiceArgoResource {
  kind: string;
  name: string;
  namespace: string | null;
  health: string | null;
  healthMessage: string | null;
  ready: string | null;
  restarts: number | null;
  createdAt: string | null;
}

export interface ServiceArgoDetail {
  appName: string;
  available: boolean;
  dataSource: string;
  syncStatus: string | null;
  healthStatus: string | null;
  healthMessage: string | null;
  revision: string | null;
  commit: ServiceArgoCommit | null;
  autoSync: boolean;
  selfHeal: boolean;
  prune: boolean;
  images: string[];
  resources: ServiceArgoResource[];
  podsReady: string | null;
  resourceSummary: string | null;
  conditions: string[];
  warnings: string[];
}

const FALLBACK_API = "http://127.0.0.1:8000";
const FALLBACK_GITHUB_REPO_URL = "https://github.com/calavelas/ENDR";
const FALLBACK_GITHUB_BRANCH = "main";

function encodePathSegments(value: string): string {
  return value
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeApiBase(base: string): string {
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

export function resolveApiBase(): string {
  const base = process.env.ENDR_API_URL || process.env.NEXT_PUBLIC_ENDR_API_URL || FALLBACK_API;
  return normalizeApiBase(base);
}

// Returns "" when no embed URL is configured (e.g. the cluster-free demo, where
// there is no live ArgoCD). Consumers must treat an empty value as "no embed":
// the panel renders a placeholder and per-app links are hidden.
export function resolveArgoEmbedUrl(): string {
  const value =
    process.env.PORTAL_ARGOCD_EMBED_URL ||
    process.env.NEXT_PUBLIC_PORTAL_ARGOCD_EMBED_URL ||
    process.env.NEXT_PUBLIC_ARGOCD_EMBED_URL ||
    "";
  return value.trim();
}

export function resolveGithubRepoUrl(): string {
  const value =
    process.env.PORTAL_GITHUB_REPO_URL || process.env.NEXT_PUBLIC_PORTAL_GITHUB_REPO_URL || process.env.NEXT_PUBLIC_GITHUB_REPO_URL;
  return value?.trim() || FALLBACK_GITHUB_REPO_URL;
}

export function resolveGithubBranch(): string {
  const value = process.env.PORTAL_GITHUB_BRANCH || process.env.NEXT_PUBLIC_PORTAL_GITHUB_BRANCH;
  return value?.trim() || FALLBACK_GITHUB_BRANCH;
}

export function buildArgoApplicationUrl(embedUrl: string, appName: string): string {
  if (!embedUrl.trim()) {
    return "";
  }
  const name = appName.trim();
  if (!name) {
    return embedUrl;
  }

  try {
    const parsed = new URL(embedUrl);
    parsed.pathname = `/applications/argocd/${encodeURIComponent(name)}`;
    parsed.search = "resource=";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    const trimmed = embedUrl.trim().replace(/\/+$/, "");
    const base = trimmed.includes("/applications") ? trimmed.replace(/\/applications.*$/, "/applications") : `${trimmed}/applications`;
    return `${base}/argocd/${encodeURIComponent(name)}?resource=`;
  }
}

export function buildServiceFolderPath(serviceName: string): string {
  return `SVCS/${serviceName.trim()}`;
}

export function buildGithubFolderUrl(repoUrl: string, branch: string, folderPath: string): string {
  const cleanedRepo = repoUrl.trim().replace(/\/+$/, "");
  const cleanedBranch = branch.trim() || FALLBACK_GITHUB_BRANCH;
  const cleanedPath = folderPath.trim().replace(/^\/+/, "");

  return `${cleanedRepo}/tree/${encodePathSegments(cleanedBranch)}/${encodePathSegments(cleanedPath)}`;
}

export function buildGithubFileUrl(repoUrl: string, branch: string, filePath: string): string {
  const cleanedRepo = repoUrl.trim().replace(/\/+$/, "");
  const cleanedBranch = branch.trim() || FALLBACK_GITHUB_BRANCH;
  const cleanedPath = filePath.trim().replace(/^\/+/, "");

  return `${cleanedRepo}/blob/${encodePathSegments(cleanedBranch)}/${encodePathSegments(cleanedPath)}`;
}

export function buildGithubRawFileUrl(repoUrl: string, branch: string, filePath: string): string {
  const cleanedBranch = branch.trim() || FALLBACK_GITHUB_BRANCH;
  const cleanedPath = filePath.trim().replace(/^\/+/, "");

  try {
    const parsed = new URL(repoUrl.trim());
    if (parsed.hostname === "github.com") {
      const parts = parsed.pathname.split("/").filter((part) => part.length > 0);
      if (parts.length >= 2) {
        const owner = encodeURIComponent(parts[0]);
        const repo = encodeURIComponent(parts[1].replace(/\.git$/, ""));
        return `https://raw.githubusercontent.com/${owner}/${repo}/${encodePathSegments(cleanedBranch)}/${encodePathSegments(cleanedPath)}`;
      }
    }
  } catch {
    // Fallback to blob URL if repository URL parsing fails.
  }

  return buildGithubFileUrl(repoUrl, cleanedBranch, cleanedPath);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function syncTone(status: string): NodeTone {
  const value = normalize(status);
  if (value === "synced") {
    return "good";
  }
  if (value === "outofsync" || value === "missing") {
    return "bad";
  }
  if (value === "progressing" || value === "unknown") {
    return "warn";
  }
  return "neutral";
}

export function healthTone(status: string): NodeTone {
  const value = normalize(status);
  if (value === "healthy") {
    return "good";
  }
  if (value === "degraded" || value === "suspended" || value === "missing") {
    return "bad";
  }
  if (value === "progressing" || value === "unknown") {
    return "warn";
  }
  return "neutral";
}

export function dataSourceTone(source: string): NodeTone {
  const value = normalize(source);
  if (value === "argocd") {
    return "good";
  }
  if (value === "config") {
    return "warn";
  }
  if (value === "fallback") {
    return "bad";
  }
  return "neutral";
}

export function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export function optionalTimestamp(value: string | null): string {
  if (!value) {
    return "n/a";
  }
  return formatTimestamp(value);
}

export function shortRevision(revision: string): string {
  const value = revision.trim();
  if (!value) {
    return "n/a";
  }
  if (/^[a-f0-9]{12,}$/i.test(value)) {
    return value.slice(0, 12);
  }
  return value;
}

function buildFallbackSnapshot(reason: string): PlatformSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    dataSource: "fallback",
    clusterName: "gargantua",
    clusterPath: "KUBE/clusters/gargantua/core",
    servicesPath: "KUBE/clusters/gargantua/services",
    warnings: [reason],
    platformServices: [
      {
        name: "lab",
        kind: "core",
        namespace: "argocd",
        syncStatus: "Unknown",
        healthStatus: "Unknown",
        sourcePath: "KUBE/clusters/gargantua/core.yaml",
        revision: "main",
        deployedAt: null,
        imageTag: null,
        templateName: "Platform",
        gatewayEnabled: false,
        serviceUrl: null,
      }
    ],
    services: []
  };
}

const SNAPSHOT_FETCH_TIMEOUT_MS = 8000;

export async function loadSnapshot(): Promise<PlatformSnapshot> {
  const apiBase = resolveApiBase();
  const endpoint = `${apiBase}/api/platform`;

  // Bound the request so a slow/hung backend can never stall a server render.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SNAPSHOT_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as PlatformSnapshot;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return buildFallbackSnapshot(`Unable to reach ENDR API at ${endpoint}: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

function unavailableArgoDetail(name: string, reason: string): ServiceArgoDetail {
  return {
    appName: name,
    available: false,
    dataSource: "unavailable",
    syncStatus: null,
    healthStatus: null,
    healthMessage: null,
    revision: null,
    commit: null,
    autoSync: false,
    selfHeal: false,
    prune: false,
    images: [],
    resources: [],
    podsReady: null,
    resourceSummary: null,
    conditions: [],
    warnings: [reason],
  };
}

// Richer per-service ArgoCD read (deployed commit, pods/resource tree, health
// reasons). Never throws — degrades to an unavailable detail the view handles.
export async function loadServiceArgoDetail(name: string): Promise<ServiceArgoDetail> {
  const apiBase = resolveApiBase();
  const endpoint = `${apiBase}/api/platform/services/${encodeURIComponent(name)}/argocd`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SNAPSHOT_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as ServiceArgoDetail;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return unavailableArgoDetail(name, `Unable to reach ENDR API: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

export interface DecommissionEligibility {
  serviceName: string;
  decommissionable: boolean;
  protected: boolean;
  reason: string;
}

export async function loadDecommissionEligibility(name: string): Promise<DecommissionEligibility> {
  const apiBase = resolveApiBase();
  const endpoint = `${apiBase}/api/platform/services/${encodeURIComponent(name)}/decommission`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SNAPSHOT_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as DecommissionEligibility;
  } catch {
    // Fail safe: if eligibility can't be determined, treat as not decommissionable.
    return { serviceName: name, decommissionable: false, protected: false, reason: "eligibility unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

export function sortByName(nodes: ServiceNode[]): ServiceNode[] {
  return [...nodes].sort((left, right) => left.name.localeCompare(right.name));
}

export function hasAttention(node: ServiceNode): boolean {
  return syncTone(node.syncStatus) === "bad" || healthTone(node.healthStatus) === "bad";
}

export function findServiceByName(services: ServiceNode[], name: string): ServiceNode | undefined {
  const expected = normalize(name);
  return services.find((service) => normalize(service.name) === expected);
}

export function findPlatformServiceByName(platformServices: ServiceNode[], name: string): ServiceNode | undefined {
  const expected = normalize(name);
  return platformServices.find((app) => normalize(app.name) === expected);
}
