"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface CaseHistoryItem {
  number: number;
  title: string;
  serviceName: string;
  htmlUrl: string;
  state: string;
  merged: boolean;
  draft: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  headRef: string;
  headSha: string;
  baseRef: string;
  author: string;
}

interface CaseHistoryResponse {
  sourceRepo: string;
  titlePrefix: string;
  serviceFilter?: string | null;
  authorFilter?: string | null;
  prStateFilter?: string;
  count: number;
  items: CaseHistoryItem[];
}

function readErrorMessage(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (typeof detail === "string") {
      return detail;
    }
    return JSON.stringify(detail);
  }
  return "request failed";
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "n/a";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function prTone(item: CaseHistoryItem): "good" | "warn" | "neutral" {
  if (item.merged) {
    return "good";
  }
  if (item.state === "open") {
    return "warn";
  }
  return "neutral";
}

function prLabel(item: CaseHistoryItem): string {
  if (item.merged) {
    return "merged";
  }
  if (item.draft && item.state === "open") {
    return "draft";
  }
  return item.state || "unknown";
}

function matchesPrState(item: CaseHistoryItem, filter: string): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "merged") {
    return item.merged;
  }
  if (filter === "open") {
    return item.state === "open";
  }
  if (filter === "closed") {
    return item.state === "closed" && !item.merged;
  }
  return true;
}

function Badge({ label, tone }: { label: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  return (
    <span className={`mc-badge ${tone}`}>
      <span className="mc-badge-dot" />
      {label}
    </span>
  );
}

export function HistoryPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<CaseHistoryResponse | null>(null);
  const [prStateFilter, setPrStateFilter] = useState("all");
  const [authorFilter, setAuthorFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/platform/history?limit=120", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as unknown;
        if (!response.ok) {
          throw new Error(readErrorMessage(body));
        }
        if (!cancelled) {
          setHistory(body as CaseHistoryResponse);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const detail = err instanceof Error ? err.message : "unable to load service history";
          setError(detail);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const items = history?.items ?? [];

  const authors = useMemo(() => {
    return [...new Set(items.map((item) => item.author).filter((value) => value && value.trim()))].sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!matchesPrState(item, prStateFilter)) {
        return false;
      }
      if (authorFilter !== "all" && item.author !== authorFilter) {
        return false;
      }
      return true;
    });
  }, [authorFilter, items, prStateFilter]);

  if (loading) {
    return (
      <section className="mc-panel">
        <p className="mc-muted">Loading delivery history…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mc-panel">
        <p className="form-error" role="alert">
          {error}
        </p>
      </section>
    );
  }

  const mergedCount = items.filter((item) => item.merged).length;
  const openCount = items.filter((item) => item.state === "open").length;

  return (
    <>
      <section className="mc-kpis">
        <div className="mc-kpi neutral">
          <span className="mc-kpi-value">{items.length}</span>
          <span className="mc-kpi-label">Pull requests</span>
          <span className="mc-kpi-sub">Portal-created</span>
        </div>
        <div className="mc-kpi good">
          <span className="mc-kpi-value">{mergedCount}</span>
          <span className="mc-kpi-label">Merged</span>
          <span className="mc-kpi-sub">Shipped</span>
        </div>
        <div className="mc-kpi warn">
          <span className="mc-kpi-value">{openCount}</span>
          <span className="mc-kpi-label">Open</span>
          <span className="mc-kpi-sub">In flight</span>
        </div>
      </section>

      <div className="mc-toolbar">
        <label className="mc-filter">
          <span>PR state</span>
          <select className="mc-select" value={prStateFilter} onChange={(event) => setPrStateFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="merged">Merged</option>
            <option value="closed">Closed (not merged)</option>
          </select>
        </label>
        <label className="mc-filter">
          <span>Author</span>
          <select className="mc-select" value={authorFilter} onChange={(event) => setAuthorFilter(event.target.value)}>
            <option value="all">All</option>
            {authors.map((author) => (
              <option key={author} value={author}>
                {author}
              </option>
            ))}
          </select>
        </label>
        <span className="mc-toolbar-note">
          {filteredItems.length} of {items.length}
        </span>
      </div>

      <section className="mc-panel">
        <div className="mc-panel-head">
          <h2 className="mc-panel-title">Delivery history</h2>
          <span className="mc-count-chip">{filteredItems.length}</span>
        </div>
        <p className="mc-muted" style={{ margin: "0 0 0.6rem", fontSize: "0.82rem" }}>
          Each row is a portal pull request. Open the PR on GitHub to see its live CI checks —
          that&apos;s the source of truth for pipeline status.
        </p>
        {filteredItems.length === 0 ? (
          <p className="mc-empty">No portal-created pull requests match the current filters.</p>
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>PR</th>
                  <th>PR Status</th>
                  <th>Author</th>
                  <th>Created</th>
                  <th>Merged</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.number}>
                    <td>
                      {item.serviceName ? (
                        <Link className="mc-table-name" href={`/history/${encodeURIComponent(item.serviceName)}`}>
                          {item.serviceName}
                        </Link>
                      ) : (
                        <span className="mc-muted">n/a</span>
                      )}
                    </td>
                    <td>
                      <a className="mc-extlink" href={item.htmlUrl} target="_blank" rel="noreferrer">
                        #{item.number}
                      </a>
                    </td>
                    <td>
                      <Badge label={prLabel(item)} tone={prTone(item)} />
                    </td>
                    <td>{item.author}</td>
                    <td>{formatTimestamp(item.createdAt)}</td>
                    <td>{formatTimestamp(item.mergedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
