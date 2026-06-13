"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { environmentLabel, platformServiceLabel, useNarrative } from "../lib/narrative";
import {
  buildArgoApplicationUrl,
  buildGithubFolderUrl,
  buildServiceFolderPath,
  healthTone,
  optionalTimestamp,
  shortRevision,
  sortByName,
  syncTone,
  type NodeTone,
  type ServiceNode,
} from "../lib/platform";
import { Explain } from "./explain";
import * as Icon from "./icons";
import { StageRail } from "./stage-rail";

type View = "cards" | "table";
type ToneFilter = "all" | NodeTone;

interface CatalogExplorerProps {
  services: ServiceNode[];
  platformServices: ServiceNode[];
  embedUrl: string;
  githubRepoUrl: string;
  githubBranch: string;
}

interface Group {
  id: "application" | "platform";
  label: string;
  items: ServiceNode[];
  basePath: string;
}

function Badge({ status, tone }: { status: string; tone: NodeTone }) {
  return (
    <span className={`mc-badge ${tone}`}>
      <span className="mc-badge-dot" />
      {status}
    </span>
  );
}

export function CatalogExplorer({
  services,
  platformServices,
  embedUrl,
  githubRepoUrl,
  githubBranch,
}: CatalogExplorerProps) {
  const { mode, t } = useNarrative();
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState<ToneFilter>("all");
  const [sync, setSync] = useState<ToneFilter>("all");
  const [view, setView] = useState<View>("cards");

  useEffect(() => {
    const saved = window.localStorage.getItem("endr-catalog-view");
    if (saved === "cards" || saved === "table") {
      setView(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("endr-catalog-view", view);
  }, [view]);

  const matches = (service: ServiceNode) => {
    if (query && !service.name.toLowerCase().includes(query.trim().toLowerCase())) {
      return false;
    }
    if (health !== "all" && healthTone(service.healthStatus) !== health) {
      return false;
    }
    if (sync !== "all" && syncTone(service.syncStatus) !== sync) {
      return false;
    }
    return true;
  };

  const groups: Group[] = [
    {
      id: "application",
      label: mode === "interstellar" ? "Robots" : "Application Services",
      items: sortByName(services),
      basePath: "/application-services",
    },
    {
      id: "platform",
      label: mode === "interstellar" ? "Subsystems" : "Platform Services",
      items: sortByName(platformServices),
      basePath: "/platform-services",
    },
  ];

  const displayName = (group: Group, service: ServiceNode) =>
    group.id === "platform" ? platformServiceLabel(service.name, mode) : service.name;

  return (
    <>
      <StageRail active="operate" />

      <div className="mc-page-actions">
        <Link href="/create" className="mc-btn mc-btn-lg">
          <Icon.Plus size={16} />
          {t.createCta}
        </Link>
        {embedUrl ? (
          <a href={embedUrl} target="_blank" rel="noreferrer" className="mc-btn mc-btn-lg mc-btn-soft">
            Open ArgoCD
            <Icon.ExternalLink size={14} />
          </a>
        ) : null}
      </div>

      <Explain
        idp={
          <>
            Your <b>service catalog</b> — every service ENDR runs, with live health and sync straight
            from ArgoCD. Open one to inspect its config, or <b>create</b> a new one to start the
            delivery flow.
          </>
        }
        interstellar={
          <>
            Your <b>fleet</b> — every robot in service, with live health and sync from the autopilot.
            Open one to inspect it, or <b>build</b> a new one to start a mission.
          </>
        }
      />

      <div className="mc-toolbar">
        <input
          className="mc-toolbar-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={mode === "interstellar" ? "Search robots…" : "Search services…"}
          aria-label="Search"
        />
        <select
          className="mc-select"
          value={health}
          onChange={(event) => setHealth(event.target.value as ToneFilter)}
          aria-label="Filter by health"
        >
          <option value="all">All health</option>
          <option value="good">Healthy</option>
          <option value="warn">Warning</option>
          <option value="bad">Degraded</option>
          <option value="neutral">Unknown</option>
        </select>
        <select
          className="mc-select"
          value={sync}
          onChange={(event) => setSync(event.target.value as ToneFilter)}
          aria-label="Filter by sync"
        >
          <option value="all">All sync</option>
          <option value="good">Synced</option>
          <option value="warn">Progressing</option>
          <option value="bad">Out of sync</option>
          <option value="neutral">Unknown</option>
        </select>
        <div className="mc-seg" role="group" aria-label="View">
          <button type="button" className={`mc-seg-opt${view === "cards" ? " on" : ""}`} onClick={() => setView("cards")}>
            Cards
          </button>
          <button type="button" className={`mc-seg-opt${view === "table" ? " on" : ""}`} onClick={() => setView("table")}>
            Table
          </button>
        </div>
      </div>

      {groups.map((group) => {
        const filtered = group.items.filter(matches);
        return (
          <section className="mc-section" key={group.id}>
            <div className="mc-section-head">
              <h2 className="mc-section-title">{group.label}</h2>
              <span className="mc-count-chip">{filtered.length}</span>
            </div>

            {filtered.length === 0 ? (
              <p className="mc-empty">No matching {mode === "interstellar" ? "robots" : "services"}.</p>
            ) : view === "cards" ? (
              <div className="mc-card-grid">
                {filtered.map((service) => (
                  <Link
                    key={service.name}
                    href={`${group.basePath}/${encodeURIComponent(service.name)}`}
                    className="mc-card"
                  >
                    <div className="mc-card-head">
                      <span className="mc-card-name">{displayName(group, service)}</span>
                      <Badge status={service.healthStatus} tone={healthTone(service.healthStatus)} />
                    </div>
                    <div className="mc-card-meta">
                      <Badge status={service.syncStatus} tone={syncTone(service.syncStatus)} />
                      <span className="mc-chip">
                        <span className="mc-chip-key">{t.namespaceLabel}</span>
                        {environmentLabel(service.namespace, mode)}
                      </span>
                      {service.imageTag ? (
                        <span className="mc-chip mc-mono">{service.imageTag}</span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mc-panel">
                <div className="mc-table-wrap">
                  <table className="mc-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Health</th>
                        <th>Sync</th>
                        <th>{t.namespaceLabel}</th>
                        <th>Image</th>
                        <th>Revision</th>
                        <th>Updated</th>
                        <th>ArgoCD</th>
                        <th>GitHub</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((service) => {
                        const folder =
                          group.id === "application" ? buildServiceFolderPath(service.name) : service.sourcePath;
                        return (
                          <tr key={service.name}>
                            <td>
                              <Link
                                className="mc-table-name"
                                href={`${group.basePath}/${encodeURIComponent(service.name)}`}
                              >
                                {displayName(group, service)}
                              </Link>
                            </td>
                            <td>
                              <Badge status={service.healthStatus} tone={healthTone(service.healthStatus)} />
                            </td>
                            <td>
                              <Badge status={service.syncStatus} tone={syncTone(service.syncStatus)} />
                            </td>
                            <td>{environmentLabel(service.namespace, mode)}</td>
                            <td className="mc-mono">{service.imageTag ?? "n/a"}</td>
                            <td className="mc-mono">{shortRevision(service.revision)}</td>
                            <td>{optionalTimestamp(service.deployedAt)}</td>
                            <td>
                              {embedUrl ? (
                                <a
                                  className="mc-extlink"
                                  href={buildArgoApplicationUrl(embedUrl, service.name)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open
                                </a>
                              ) : (
                                <span className="mc-muted">n/a</span>
                              )}
                            </td>
                            <td>
                              {folder ? (
                                <a
                                  className="mc-extlink"
                                  href={buildGithubFolderUrl(githubRepoUrl, githubBranch, folder)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Folder
                                </a>
                              ) : (
                                <span className="mc-muted">n/a</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
