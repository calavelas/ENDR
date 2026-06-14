"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import * as Icon from "./icons";

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

type Tone = "good" | "warn" | "neutral";

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

function prTone(item: CaseHistoryItem): Tone {
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

function Badge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={`mc-badge ${tone}`}>
      <span className="mc-badge-dot" />
      {label}
    </span>
  );
}

const RECENT_LIMIT = 5;

export function ServiceDeliveryPanel({ serviceName }: { serviceName: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<CaseHistoryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setHistory(null);

    const params = new URLSearchParams({ limit: "20", service: serviceName });
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
          setError(err instanceof Error ? err.message : "unable to load delivery history");
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

  const items = history?.items ?? [];
  const recent = items.slice(0, RECENT_LIMIT);

  return (
    <section className="mc-panel mc-detail-span" aria-label="service-delivery">
      <div className="mc-panel-head">
        <h2 className="mc-panel-title">Pull requests</h2>
        {items.length ? <span className="mc-count-chip">{items.length}</span> : null}
        <Link className="mc-link-all" href={`/history/${encodeURIComponent(serviceName)}`}>
          Full history
          <Icon.ChevronRight size={13} />
        </Link>
      </div>

      {loading ? (
        <p className="mc-muted" style={{ marginTop: 0 }}>
          Loading pull requests…
        </p>
      ) : error ? (
        <p className="form-error" role="alert" style={{ marginTop: 0 }}>
          {error}
        </p>
      ) : recent.length === 0 ? (
        <p className="mc-empty">
          No pull requests yet. Changes to this service ship as pull requests — they&apos;ll appear here.
        </p>
      ) : (
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
              </tr>
            </thead>
            <tbody>
              {recent.map((item) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
