"use client";

import Link from "next/link";

import { environmentLabel, platformServiceLabel, useNarrative } from "../lib/narrative";
import type { NodeTone } from "../lib/platform";
import * as Icon from "./icons";

// All time-sensitive and data-derived values are computed server-side and
// passed in as plain strings/numbers — this component only handles narrative
// labelling (which depends on the live toggle) and presentation.
export interface MissionRow {
  name: string;
  status: string;
  tone: NodeTone;
  template: string;
  namespace: string;
  endpoint: string;
  endpointHost: string;
  healthPct: number;
  revision: string;
  deployed: string;
  href: string;
  attention: boolean;
}

export interface PlatformRow {
  name: string;
  status: string;
  tone: NodeTone;
}

export interface ActivityItem {
  tone: "good" | "bad";
  title: string;
  sub: string;
  time: string;
}

export interface DashboardStats {
  servicesActive: number;
  healthy: number;
  healthyPct: number;
  deployments: number;
}

export interface DashboardViewProps {
  stats: DashboardStats;
  rows: MissionRow[];
  platform: PlatformRow[];
  activity: ActivityItem[];
  githubUrl: string;
}

function StatusBadge({ status, tone }: { status: string; tone: NodeTone }) {
  return (
    <span className={`mc-badge ${tone}`}>
      <span className="mc-badge-dot" />
      {status}
    </span>
  );
}

export function DashboardView({ stats, rows, platform, activity, githubUrl }: DashboardViewProps) {
  const { mode, t } = useNarrative();

  const kpis: Array<{ value: string; label: string; sub: string; tone: NodeTone }> = [
    { value: String(stats.servicesActive), label: "Services", sub: "Active", tone: "neutral" },
    { value: String(stats.healthy), label: "Healthy", sub: `${stats.healthyPct}%`, tone: "good" },
    { value: String(stats.deployments), label: "Deployments", sub: "vs last 7 days", tone: "warn" },
  ];

  return (
    <div className="mc">
      <div className="mc-grid">
        <div className="mc-main">
          {/* Welcome */}
          <section className="mc-panel mc-welcome">
            <h2 className="mc-welcome-title">{t.welcome}</h2>
            <p className="mc-welcome-tagline">{t.tagline}</p>
            <p className="mc-welcome-copy">{t.heroCopy}</p>
            <div className="mc-welcome-actions">
              <Link href="/create" className="mc-btn mc-btn-lg">
                <Icon.Plus size={17} />
                {t.createCta}
              </Link>
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className="mc-btn mc-btn-lg mc-btn-soft"
              >
                View documentation
                <Icon.ExternalLink size={15} />
              </a>
            </div>
          </section>

          {/* KPI cards */}
          <section className="mc-kpis">
            {kpis.map((kpi) => (
              <div className={`mc-kpi ${kpi.tone}`} key={kpi.label}>
                <span className="mc-kpi-value">{kpi.value}</span>
                <span className="mc-kpi-label">{kpi.label}</span>
                <span className="mc-kpi-sub">{kpi.sub}</span>
              </div>
            ))}
          </section>

          {/* Active services / missions */}
          <section className="mc-panel mc-missions">
            <div className="mc-panel-head">
              <h2 className="mc-panel-title">{t.activeSection}</h2>
              <Link href="/catalog" className="mc-link-all">
                View all
              </Link>
            </div>

            {rows.length === 0 ? (
              <p className="mc-empty">No services yet. Create one to get started.</p>
            ) : (
              <div className="mc-table-wrap">
                <table className="mc-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Status</th>
                      <th>{t.modelLabel}</th>
                      <th>{t.namespaceLabel}</th>
                      <th>Revision</th>
                      <th>Deployed</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.name}>
                        <td>
                          <Link href={row.href} className="mc-table-name">
                            {row.name}
                          </Link>
                          <a
                            className="mc-table-endpoint"
                            href={row.endpoint}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {row.endpointHost}
                            <Icon.ExternalLink size={11} />
                          </a>
                        </td>
                        <td>
                          <StatusBadge status={row.status} tone={row.tone} />
                        </td>
                        <td>{row.template}</td>
                        <td>{environmentLabel(row.namespace, mode)}</td>
                        <td className="mc-mono">{row.revision}</td>
                        <td className="mc-mono">{row.deployed}</td>
                        <td className="mc-table-action">
                          <Link href={row.href} className="mc-btn mc-btn-sm">
                            {row.attention ? "Investigate" : "View"}
                            <Icon.ArrowRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Link href="/create" className="mc-mission-create">
              <span className="mc-create-ic">
                <Icon.Plus size={18} />
              </span>
              <span className="mc-create-text">
                <strong>{t.createCardTitle}</strong>
                <span>{t.createCardSub}</span>
              </span>
            </Link>
          </section>
        </div>

        {/* Right rail */}
        <div className="mc-rail">
          <section className="mc-panel mc-platform">
            <div className="mc-panel-head">
              <h2 className="mc-panel-title">{t.statusPanelTitle}</h2>
            </div>
            {platform.length === 0 ? (
              <p className="mc-empty">No platform services found.</p>
            ) : (
              <div className="mc-platform-grid">
                {platform.map((row) => (
                  <Link
                    href={`/platform-services/${encodeURIComponent(row.name)}`}
                    className={`mc-pcard ${row.tone}`}
                    key={row.name}
                  >
                    <span className="mc-pcard-name">{platformServiceLabel(row.name, mode)}</span>
                    <span className="mc-pcard-status">
                      <span className="mc-pcard-dot" />
                      {row.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            <Link href="/argocd" className="mc-btn mc-btn-block">
              View platform health
            </Link>
          </section>

          <section className="mc-panel mc-activity">
            <div className="mc-panel-head">
              <h2 className="mc-panel-title">Recent Activity</h2>
              <Link href="/history" className="mc-link-all">
                View all
              </Link>
            </div>
            {activity.length === 0 ? (
              <p className="mc-empty">No recent activity.</p>
            ) : (
              <div className="mc-activity-list">
                {activity.map((item, index) => (
                  <div className="mc-activity-item" key={`${item.title}-${index}`}>
                    <span className={`mc-activity-ic ${item.tone}`}>
                      {item.tone === "bad" ? (
                        <Icon.AlertTriangle size={15} />
                      ) : (
                        <Icon.CheckCircle size={15} />
                      )}
                    </span>
                    <span className="mc-activity-body">
                      <span className="mc-activity-title">{item.title}</span>
                      <span className="mc-activity-sub">{item.sub}</span>
                    </span>
                    <span className="mc-activity-time">{item.time}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
