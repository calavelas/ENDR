"use client";

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
  serviceFilter: string | null;
  count: number;
  items: CaseHistoryItem[];
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

  const items = history?.items ?? [];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setHistory(null);

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

  const latest = items[0] ?? null;
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
      <section className="mc-panel" aria-label="service-history-summary">
        <div className="mc-panel-head">
          <h2 className="mc-panel-title">Latest pull request</h2>
          <Badge label={prLabel(latest)} tone={prTone(latest)} />
        </div>
        <dl className="mc-kv">
          <dt>PR</dt>
          <dd>
            <a className="mc-extlink" href={latest.htmlUrl} target="_blank" rel="noreferrer">
              #{latest.number}
            </a>
          </dd>
          <dt>Author</dt>
          <dd>{latest.author}</dd>
          <dt>Created</dt>
          <dd>{formatTimestamp(latest.createdAt)}</dd>
          <dt>Merged</dt>
          <dd>{formatTimestamp(latest.mergedAt)}</dd>
          <dt>Branch</dt>
          <dd className="mc-mono">{latest.headRef}</dd>
        </dl>
      </section>

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
                <th>Status</th>
                <th>Author</th>
                <th>Created</th>
                <th>Merged</th>
                <th>Branch</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
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
                  <td>{item.author}</td>
                  <td>{formatTimestamp(item.createdAt)}</td>
                  <td>{formatTimestamp(item.mergedAt)}</td>
                  <td className="mc-mono">{item.headRef}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
