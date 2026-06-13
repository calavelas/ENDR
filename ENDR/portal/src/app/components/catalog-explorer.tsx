"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  type ServiceNode
} from "../lib/platform";
import { ServiceCard } from "./ui/service-card";
import { Toolbar } from "./ui/toolbar";

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

function FilterSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ToneFilter;
  onChange: (value: ToneFilter) => void;
}) {
  return (
    <label className="toolbar-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as ToneFilter)}>
        <option value="all">All</option>
        <option value="good">Good</option>
        <option value="warn">Warning</option>
        <option value="bad">Bad</option>
        <option value="neutral">Neutral</option>
      </select>
    </label>
  );
}

function CatalogTable({
  group,
  items,
  embedUrl,
  githubRepoUrl,
  githubBranch,
}: {
  group: Group;
  items: ServiceNode[];
  embedUrl: string;
  githubRepoUrl: string;
  githubBranch: string;
}) {
  return (
    <section className="panel service-table-wrap">
      <table className="service-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Namespace</th>
            <th>Health</th>
            <th>Sync</th>
            <th>Image</th>
            <th>Revision</th>
            <th>Updated</th>
            <th>ArgoCD</th>
            <th>GitHub</th>
          </tr>
        </thead>
        <tbody>
          {items.map((service) => {
            const folder = group.id === "application" ? buildServiceFolderPath(service.name) : service.sourcePath;
            return (
              <tr key={service.name}>
                <td>
                  <Link className="entity-link" href={`${group.basePath}/${encodeURIComponent(service.name)}`}>
                    {service.name}
                  </Link>
                </td>
                <td>{service.namespace}</td>
                <td>
                  <span className={`status-pill tone-${healthTone(service.healthStatus)}`}>{service.healthStatus}</span>
                </td>
                <td>
                  <span className={`status-pill tone-${syncTone(service.syncStatus)}`}>{service.syncStatus}</span>
                </td>
                <td>
                  <code>{service.imageTag ?? "n/a"}</code>
                </td>
                <td>
                  <code>{shortRevision(service.revision)}</code>
                </td>
                <td>{optionalTimestamp(service.deployedAt)}</td>
                <td>
                  {embedUrl ? (
                    <a
                      className="open-link compact"
                      href={buildArgoApplicationUrl(embedUrl, service.name)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="empty-cell">n/a</span>
                  )}
                </td>
                <td>
                  {folder ? (
                    <a
                      className="entity-link"
                      href={buildGithubFolderUrl(githubRepoUrl, githubBranch, folder)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Folder
                    </a>
                  ) : (
                    <span className="empty-cell">n/a</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function CatalogExplorer({
  services,
  platformServices,
  embedUrl,
  githubRepoUrl,
  githubBranch,
}: CatalogExplorerProps) {
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
    { id: "application", label: "Application Services", items: sortByName(services), basePath: "/application-services" },
    { id: "platform", label: "Platform Services", items: sortByName(platformServices), basePath: "/platform-services" }
  ];

  return (
    <>
      <Toolbar query={query} onQuery={setQuery} placeholder="Search services…">
        <FilterSelect label="Health" value={health} onChange={setHealth} />
        <FilterSelect label="Sync" value={sync} onChange={setSync} />
        <div className="view-toggle" role="group" aria-label="View">
          <button type="button" className={view === "cards" ? "active" : ""} onClick={() => setView("cards")}>
            Cards
          </button>
          <button type="button" className={view === "table" ? "active" : ""} onClick={() => setView("table")}>
            Table
          </button>
        </div>
      </Toolbar>

      {groups.map((group) => {
        const filtered = group.items.filter(matches);
        return (
          <section className="section-block" key={group.id}>
            <div className="section-head">
              <h2>{group.label}</h2>
              <span className="chip muted">{filtered.length}</span>
            </div>
            {filtered.length === 0 ? (
              <p className="empty-cell">No matching services.</p>
            ) : view === "cards" ? (
              <div className="service-grid">
                {filtered.map((service) => (
                  <ServiceCard
                    key={service.name}
                    service={service}
                    href={`${group.basePath}/${encodeURIComponent(service.name)}`}
                    showGateway={group.id === "application"}
                  />
                ))}
              </div>
            ) : (
              <CatalogTable
                group={group}
                items={filtered}
                embedUrl={embedUrl}
                githubRepoUrl={githubRepoUrl}
                githubBranch={githubBranch}
              />
            )}
          </section>
        );
      })}
    </>
  );
}
