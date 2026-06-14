"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import * as Icon from "../../components/icons";

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
  serviceFilter: string | null;
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

interface TransactionTimelineEvent {
  id: string;
  title: string;
  status: string;
  timestamp: string | null;
  detail: string;
  url: string | null;
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
  timeline: TransactionTimelineEvent[];
  persistedAt?: string | null;
}

interface ServiceHistoryPanelProps {
  serviceName: string;
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

function normalize(value: string): string {
  return value.trim().toLowerCase();
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
  if (normalized === "waiting-merge") {
    return "Waiting Merge";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatWorkflowRunStatus(run: TransactionWorkflowRun | null): string {
  if (!run) {
    return "not started";
  }
  if (run.status !== "completed") {
    return run.status;
  }
  return run.conclusion ? `completed (${run.conclusion})` : "completed";
}

function Badge({ label, tone }: { label: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  return (
    <span className={`mc-badge ${tone}`}>
      <span className="mc-badge-dot" />
      {label}
    </span>
  );
}

export function ServiceHistoryPanel({ serviceName }: ServiceHistoryPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<CaseHistoryResponse | null>(null);
  const [transactionMap, setTransactionMap] = useState<Record<number, TransactionStatusResult>>({});
  const [transactionError, setTransactionError] = useState("");

  const items = history?.items ?? [];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setHistory(null);
    setTransactionMap({});
    setTransactionError("");

    const params = new URLSearchParams({
      limit: "50",
      service: serviceName
    });

    fetch(`/api/platform/history?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as unknown;
        if (!response.ok) {
          throw new Error(readErrorMessage(body));
        }
        if (!cancelled) {
          setHistory(body as CaseHistoryResponse);
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
  }, [serviceName]);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const openTargets = items.filter((item) => item.state === "open");
    const statusesToQuery = (openTargets.length > 0 ? openTargets : items).slice(0, 8);
    const batchSize = 3;

    const loadTransactions = async () => {
      try {
        const nextMap: Record<number, TransactionStatusResult> = {};
        for (let index = 0; index < statusesToQuery.length; index += batchSize) {
          const batch = statusesToQuery.slice(index, index + batchSize);
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
          const detail = err instanceof Error ? err.message : "unable to load transaction status";
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

  const latest = items[0] ?? null;
  const latestTransaction = latest ? transactionMap[latest.number] : null;
  const hasServiceMismatch = useMemo(
    () => items.some((item) => normalize(item.serviceName) !== normalize(serviceName)),
    [items, serviceName]
  );

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

  if (!latest) {
    return (
      <section className="mc-panel">
        <p className="mc-empty">
          No delivery history found for <code>{serviceName}</code>.
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="mc-detail-grid" aria-label="service-history-summary">
        <article className="mc-panel">
          <div className="mc-panel-head">
            <h2 className="mc-panel-title">Latest pull request</h2>
          </div>
          <dl className="mc-kv">
            <dt>PR</dt>
            <dd>
              <a className="mc-extlink" href={latest.htmlUrl} target="_blank" rel="noreferrer">
                #{latest.number}
              </a>
            </dd>
            <dt>Status</dt>
            <dd>
              <Badge label={prLabel(latest)} tone={prTone(latest)} />
            </dd>
            <dt>Author</dt>
            <dd>{latest.author}</dd>
            <dt>Created</dt>
            <dd>{formatTimestamp(latest.createdAt)}</dd>
            <dt>Merged</dt>
            <dd>{formatTimestamp(latest.mergedAt)}</dd>
            <dt>Branch</dt>
            <dd className="mc-mono">{latest.headRef}</dd>
            <dt>Head SHA</dt>
            <dd className="mc-mono">{latest.headSha.slice(0, 12)}</dd>
          </dl>
        </article>

        <article className="mc-panel" style={{ minWidth: 0 }}>
          <div className="mc-panel-head">
            <h2 className="mc-panel-title">Latest pipeline</h2>
            {latestTransaction ? (
              <Badge
                label={formatPipelineStatus(latestTransaction.pipeline.status)}
                tone={pipelineTone(latestTransaction.pipeline.status)}
              />
            ) : null}
          </div>
          {latestTransaction ? (
            <>
              <p className="mc-muted" style={{ marginTop: 0, fontSize: "0.84rem" }}>
                {latestTransaction.pipeline.message}
              </p>
              <ul className="mc-run-list">
                {[
                  { label: "PR Check", run: latestTransaction.pipeline.runs.prCheck },
                  { label: "Reconcile", run: latestTransaction.pipeline.runs.reconcileUpdate },
                  { label: "Service build/deploy", run: latestTransaction.pipeline.runs.svcsBuildDeploy },
                ].map(({ label, run }) => (
                  <li key={label} className="mc-run-item">
                    <span className="mc-run-name">{label}</span>
                    {run?.htmlUrl ? (
                      <a className="mc-extlink" href={run.htmlUrl} target="_blank" rel="noreferrer">
                        {formatWorkflowRunStatus(run)}
                      </a>
                    ) : (
                      <span className="mc-muted">{formatWorkflowRunStatus(run)}</span>
                    )}
                    <span className="mc-run-time">{formatTimestamp(run?.updatedAt || null)}</span>
                  </li>
                ))}
              </ul>
              {latestTransaction.pipeline.status === "success" ? (
                <Link
                  className="mc-btn mc-btn-sm mc-btn-soft"
                  href={`/application-services/${encodeURIComponent(serviceName)}`}
                  style={{ marginTop: "0.9rem" }}
                >
                  View service
                  <Icon.ChevronRight size={14} />
                </Link>
              ) : null}
            </>
          ) : (
            <p className="mc-muted">Pipeline detail is loading…</p>
          )}
        </article>
      </div>

      {transactionError && (
        <p className="form-error" role="alert">
          {transactionError}
        </p>
      )}

      {hasServiceMismatch && (
        <section className="mc-warning" aria-live="polite">
          <strong>Warning</strong>
          <ul>
            <li>Some results returned from GitHub do not match this service filter exactly.</li>
          </ul>
        </section>
      )}

      <section className="mc-panel">
        <div className="mc-panel-head">
          <h2 className="mc-panel-title">Pull requests</h2>
          <span className="mc-count-chip">{items.length}</span>
        </div>
        <div className="mc-table-wrap">
          <table className="mc-table">
            <thead>
              <tr>
                <th>PR</th>
                <th>Title</th>
                <th>PR Status</th>
                <th>Pipeline</th>
                <th>Author</th>
                <th>Created</th>
                <th>Merged</th>
                <th>Branch</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const status = transactionMap[item.number];
                return (
                  <tr key={item.number}>
                    <td>
                      <a className="mc-extlink" href={item.htmlUrl} target="_blank" rel="noreferrer">
                        #{item.number}
                      </a>
                    </td>
                    <td>{item.title}</td>
                    <td>
                      <Badge label={prLabel(item)} tone={prTone(item)} />
                    </td>
                    <td>
                      {status ? (
                        <Badge
                          label={formatPipelineStatus(status.pipeline.status)}
                          tone={pipelineTone(status.pipeline.status)}
                        />
                      ) : (
                        <span className="mc-muted">loading…</span>
                      )}
                    </td>
                    <td>{item.author}</td>
                    <td>{formatTimestamp(item.createdAt)}</td>
                    <td>{formatTimestamp(item.mergedAt)}</td>
                    <td className="mc-mono">{item.headRef}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
