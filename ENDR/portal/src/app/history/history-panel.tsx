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
  pipelineStatus?: string | null;
}

interface CaseHistoryResponse {
  sourceRepo: string;
  titlePrefix: string;
  serviceFilter?: string | null;
  authorFilter?: string | null;
  prStateFilter?: string;
  pipelineStatusFilter?: string;
  count: number;
  items: CaseHistoryItem[];
}

interface TransactionWorkflowRun {
  id: number;
  name: string;
  title: string;
  workflowPath: string;
  htmlUrl: string;
  event: string;
  status: string;
  conclusion: string | null;
  headBranch: string;
  headSha: string;
  runNumber: number;
  runAttempt: number;
  createdAt: string;
  updatedAt: string;
}

interface TransactionStatusResult {
  pullRequest: {
    number: number;
    title: string;
    htmlUrl: string;
    state: string;
    merged: boolean;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
    mergedAt: string | null;
    mergeCommitSha: string | null;
    headRef: string;
    headSha: string;
    baseRef: string;
  };
  pipeline: {
    status: "pending" | "running" | "success" | "failed" | "waiting-merge";
    message: string;
    notifications: string[];
    runs: {
      prCheck: TransactionWorkflowRun | null;
      reconcileUpdate: TransactionWorkflowRun | null;
      svcsBuildDeploy: TransactionWorkflowRun | null;
    };
  };
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

function pipelineTone(status: string): "good" | "warn" | "bad" | "neutral" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "success") {
    return "good";
  }
  if (normalized === "running" || normalized === "waiting-merge") {
    return "warn";
  }
  if (normalized === "failed") {
    return "bad";
  }
  return "neutral";
}

function formatPipelineStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (!normalized) {
    return "Unknown";
  }
  if (normalized === "waiting-merge") {
    return "Waiting Merge";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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

function pipelineForItem(item: CaseHistoryItem, transaction: TransactionStatusResult | undefined): string {
  if (transaction) {
    return transaction.pipeline.status;
  }
  return item.pipelineStatus?.trim() || "unknown";
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
  const [transactionMap, setTransactionMap] = useState<Record<number, TransactionStatusResult>>({});
  const [transactionError, setTransactionError] = useState("");
  const [prStateFilter, setPrStateFilter] = useState("all");
  const [pipelineFilter, setPipelineFilter] = useState("all");
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

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const openTargets = items.filter((item) => item.state === "open");
    const targets = (openTargets.length > 0 ? openTargets : items).slice(0, 12);
    const batchSize = 4;

    const loadTransactions = async () => {
      try {
        const nextMap: Record<number, TransactionStatusResult> = {};
        for (let index = 0; index < targets.length; index += batchSize) {
          const batch = targets.slice(index, index + batchSize);
          const responses = await Promise.all(
            batch.map(async (item) => {
              const response = await fetch(`/api/platform/transactions/${item.number}`, { cache: "no-store" });
              const body = (await response.json().catch(() => ({}))) as unknown;
              if (!response.ok) {
                throw new Error(`#${item.number}: ${readErrorMessage(body)}`);
              }
              return { number: item.number, status: body as TransactionStatusResult };
            })
          );
          for (const entry of responses) {
            nextMap[entry.number] = entry.status;
          }
        }

        if (!cancelled) {
          setTransactionMap(nextMap);
          setTransactionError("");
        }
      } catch (err) {
        if (!cancelled) {
          const detail = err instanceof Error ? err.message : "unable to load transaction statuses";
          setTransactionError(detail);
        }
      }
    };

    void loadTransactions();

    if (openTargets.length > 0) {
      timer = setInterval(() => {
        void loadTransactions();
      }, 45_000);
    }

    return () => {
      cancelled = true;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [items]);

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
      if (pipelineFilter !== "all") {
        const pipelineStatus = pipelineForItem(item, transactionMap[item.number]).trim().toLowerCase();
        if (pipelineStatus !== pipelineFilter) {
          return false;
        }
      }
      return true;
    });
  }, [authorFilter, items, pipelineFilter, prStateFilter, transactionMap]);

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
          <span>Pipeline</span>
          <select className="mc-select" value={pipelineFilter} onChange={(event) => setPipelineFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="running">Running</option>
            <option value="pending">Pending</option>
            <option value="waiting-merge">Waiting-merge</option>
            <option value="failed">Failed</option>
            <option value="unknown">Unknown</option>
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

      {transactionError && (
        <p className="form-error" role="alert">
          {transactionError}
        </p>
      )}

      <section className="mc-panel">
        <div className="mc-panel-head">
          <h2 className="mc-panel-title">Delivery history</h2>
          <span className="mc-count-chip">{filteredItems.length}</span>
        </div>
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
                  <th>Pipeline</th>
                  <th>Author</th>
                  <th>Created</th>
                  <th>Merged</th>
                  <th>Workflows</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const transaction = transactionMap[item.number];
                  const pipelineStatus = pipelineForItem(item, transaction);
                  const runs = transaction?.pipeline.runs;
                  return (
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
                      <td>
                        <Badge label={formatPipelineStatus(pipelineStatus)} tone={pipelineTone(pipelineStatus)} />
                      </td>
                      <td>{item.author}</td>
                      <td>{formatTimestamp(item.createdAt)}</td>
                      <td>{formatTimestamp(item.mergedAt)}</td>
                      <td>
                        <span className="mc-link-set">
                          {runs?.prCheck?.htmlUrl ? (
                            <a className="mc-extlink" href={runs.prCheck.htmlUrl} target="_blank" rel="noreferrer">
                              PR
                            </a>
                          ) : null}
                          {runs?.reconcileUpdate?.htmlUrl ? (
                            <a className="mc-extlink" href={runs.reconcileUpdate.htmlUrl} target="_blank" rel="noreferrer">
                              Reconcile
                            </a>
                          ) : null}
                          {runs?.svcsBuildDeploy?.htmlUrl ? (
                            <a className="mc-extlink" href={runs.svcsBuildDeploy.htmlUrl} target="_blank" rel="noreferrer">
                              Build
                            </a>
                          ) : null}
                          {!runs?.prCheck?.htmlUrl && !runs?.reconcileUpdate?.htmlUrl && !runs?.svcsBuildDeploy?.htmlUrl ? (
                            <span className="mc-muted">—</span>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
