"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { FileTree, type TreeFile } from "../create/file-tree";
import { CodeBlock } from "./code-block";
import { CodeEditor } from "./code-editor";
import * as Icon from "./icons";

interface FileNode {
  path: string;
  relativePath: string;
  size: number;
  editable: boolean;
}

interface FilesResponse {
  serviceName: string;
  basePath: string;
  branch: string;
  available: boolean;
  files: FileNode[];
  warnings: string[];
}

interface FileContent {
  path: string;
  size: number;
  content: string;
  editable: boolean;
  truncated: boolean;
}

interface EditResult {
  path: string;
  dryRun: boolean;
  branchName?: string;
  pullRequestUrl?: string;
  pullRequestNumber?: number;
}

function readErr(body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    return typeof detail === "string" ? detail : JSON.stringify(detail);
  }
  return "request failed";
}

const base = (name: string) => `/api/platform/services/${encodeURIComponent(name)}`;

interface TxRun {
  htmlUrl: string;
  status: string;
  conclusion: string | null;
  updatedAt: string;
}

interface TxStatus {
  pipeline: {
    status: "pending" | "running" | "success" | "failed" | "waiting-merge";
    message: string;
    runs: {
      prCheck: TxRun | null;
      reconcileUpdate: TxRun | null;
      svcsBuildDeploy: TxRun | null;
    };
  };
}

function pipelineTone(status: string): "good" | "warn" | "bad" | "neutral" {
  const s = status.trim().toLowerCase();
  if (s === "success") return "good";
  if (s === "running" || s === "waiting-merge") return "warn";
  if (s === "failed") return "bad";
  return "neutral";
}

function fmtPipeline(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "waiting-merge") return "Waiting merge";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function runStatus(run: TxRun | null): string {
  if (!run) return "not started";
  if (run.status !== "completed") return run.status;
  return run.conclusion ? `completed (${run.conclusion})` : "completed";
}

function fmtTime(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString();
}

// Live status for the PR the edit just opened: validate -> merge -> reconcile ->
// ArgoCD deploy. Polls the same transaction endpoint the delivery page uses, and
// stops once the pipeline reaches a terminal state.
function EditPrStatus({ prNumber }: { prNumber: number }) {
  const [status, setStatus] = useState<TxStatus | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const load = async () => {
      try {
        const response = await fetch(`/api/platform/transactions/${prNumber}`, { cache: "no-store" });
        const body = (await response.json().catch(() => ({}))) as unknown;
        if (!response.ok) throw new Error(readErr(body));
        if (cancelled) return;
        const data = body as TxStatus;
        setStatus(data);
        setErr("");
        if (data.pipeline?.status === "success" || data.pipeline?.status === "failed") stop();
      } catch (error) {
        if (!cancelled) setErr(error instanceof Error ? error.message : "unable to load pipeline status");
      }
    };
    void load();
    timer = setInterval(load, 8000);
    return () => {
      cancelled = true;
      stop();
    };
  }, [prNumber]);

  if (err) {
    return (
      <p className="form-error" role="alert" style={{ marginTop: "0.8rem" }}>
        {err}
      </p>
    );
  }
  if (!status) {
    return (
      <p className="mc-muted" style={{ marginTop: "0.8rem", fontSize: "0.82rem" }}>
        Checking pipeline status…
      </p>
    );
  }

  const rows = [
    { label: "PR Check", run: status.pipeline.runs.prCheck },
    { label: "Reconcile", run: status.pipeline.runs.reconcileUpdate },
    { label: "Service build/deploy", run: status.pipeline.runs.svcsBuildDeploy },
  ];

  return (
    <div style={{ marginTop: "1rem" }}>
      <div className="mc-panel-head" style={{ marginBottom: 0 }}>
        <h3 className="mc-panel-title" style={{ fontSize: "0.72rem" }}>
          Pipeline
        </h3>
        <span className={`mc-badge ${pipelineTone(status.pipeline.status)}`}>
          <span className="mc-badge-dot" />
          {fmtPipeline(status.pipeline.status)}
        </span>
      </div>
      <p className="mc-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
        {status.pipeline.message}
      </p>
      <ul className="mc-run-list">
        {rows.map(({ label, run }) => (
          <li key={label} className="mc-run-item">
            <span className="mc-run-name">{label}</span>
            {run?.htmlUrl ? (
              <a className="mc-extlink" href={run.htmlUrl} target="_blank" rel="noreferrer">
                {runStatus(run)}
              </a>
            ) : (
              <span className="mc-muted">{runStatus(run)}</span>
            )}
            <span className="mc-run-time">{fmtTime(run?.updatedAt ?? null)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The "Files" tab: the service's GitOps source tree (from GitHub) + a viewer. The
// chart values.yaml is editable; saving opens a PR (Phase D — the FIX flow).
export function ServiceFilesTab({
  serviceName,
  thing,
  argoUrl,
}: {
  serviceName: string;
  thing: string;
  argoUrl?: string;
}) {
  const [files, setFiles] = useState<FileNode[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loadError, setLoadError] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [content, setContent] = useState<FileContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [result, setResult] = useState<EditResult | null>(null);

  const openFile = async (path: string) => {
    setActive(path);
    setContent(null);
    setContentError("");
    setContentLoading(true);
    setEditing(false);
    setResult(null);
    setSaveError("");
    try {
      const response = await fetch(`${base(serviceName)}/file?path=${encodeURIComponent(path)}`, { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) throw new Error(readErr(body));
      setContent(body as FileContent);
    } catch (error) {
      setContentError(error instanceof Error ? error.message : "unable to load file");
    } finally {
      setContentLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${base(serviceName)}/files`, { cache: "no-store" });
        const body = (await response.json().catch(() => ({}))) as unknown;
        if (!response.ok) throw new Error(readErr(body));
        const data = body as FilesResponse;
        if (cancelled) return;
        setFiles(data.files);
        setWarnings(data.warnings ?? []);
        const def =
          data.files.find((file) => file.editable) ??
          data.files.find((file) => /values\.yaml$/.test(file.path)) ??
          data.files[0];
        if (def) void openFile(def.path);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "unable to load files");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceName]);

  const save = async () => {
    if (!content) return;
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch(`${base(serviceName)}/file`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: content.path, content: draft }),
      });
      const body = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) throw new Error(readErr(body));
      setResult(body as EditResult);
      setContent({ ...content, content: draft });
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "unable to save");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return <p className="mc-empty" role="alert">{loadError}</p>;
  }
  if (!files) {
    return <p className="mc-muted">Loading files…</p>;
  }
  if (files.length === 0) {
    return <p className="mc-empty">{warnings[0] ?? "No files found for this service."}</p>;
  }

  const treeFiles: TreeFile[] = files.map((file) => ({ path: file.path, size: file.size }));
  const fileName = content ? content.path.split("/").slice(-1)[0] : "File viewer";

  return (
    <div className="mc-files-grid">
      <section className="mc-panel mc-files-tree">
        <div className="mc-panel-head">
          <h2 className="mc-panel-title">Repo files</h2>
        </div>
        <p className="mc-muted" style={{ marginTop: 0, fontSize: "0.78rem" }}>
          This {thing}&apos;s GitOps source. <code>values.yaml</code> is editable.
        </p>
        <FileTree files={treeFiles} onOpenFile={(file) => void openFile(file.path)} activePath={active ?? undefined} lazy />
      </section>

      <section className="mc-panel mc-files-viewer" style={{ minWidth: 0 }}>
        <div className="mc-panel-head">
          <h2 className="mc-panel-title">{fileName}</h2>
          {content?.editable && !editing && !result ? (
            <button type="button" className="mc-btn mc-btn-sm" onClick={() => { setDraft(content.content); setEditing(true); }}>
              <Icon.FileText size={14} />
              Edit
            </button>
          ) : null}
        </div>

        {contentLoading ? (
          <p className="mc-muted">Loading…</p>
        ) : contentError ? (
          <p className="mc-empty" role="alert">{contentError}</p>
        ) : !content ? (
          <p className="mc-muted">Select a file.</p>
        ) : editing ? (
          <>
            <p className="mc-muted" style={{ fontSize: "0.78rem", marginTop: 0 }}>
              Editing <code>{content.path}</code> — chart values only. Templates stay platform-owned.
            </p>
            <CodeEditor value={draft} onChange={setDraft} language="yaml" ariaLabel={content.path} />
            {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
            <div className="wiz-nav" style={{ marginTop: "0.8rem" }}>
              <button type="button" className="mc-btn mc-btn-soft" onClick={() => { setEditing(false); setSaveError(""); }} disabled={saving}>
                Cancel
              </button>
              <span className="wiz-nav-spacer" />
              <span className="wiz-nav-hint">Opens a PR; ArgoCD rolls it out on merge.</span>
              <button type="button" className="mc-btn" onClick={() => void save()} disabled={saving}>
                <Icon.Plus size={14} />
                {saving ? "Opening PR…" : "Propose change"}
              </button>
            </div>
          </>
        ) : result ? (
          <>
            <div className="mc-warning" style={{ borderColor: "color-mix(in srgb, var(--mc-good) 40%, transparent)", background: "color-mix(in srgb, var(--mc-good) 8%, transparent)" }}>
              <strong>Pull request opened</strong> — CI validates it, it auto-merges, then ArgoCD rolls out the change.
              <dl className="mc-kv" style={{ marginTop: "0.6rem" }}>
                <dt>Branch</dt>
                <dd className="mc-mono">{result.branchName ?? "n/a"}</dd>
                <dt>Pull Request</dt>
                <dd>
                  {result.pullRequestUrl ? (
                    <a className="mc-extlink" href={result.pullRequestUrl} target="_blank" rel="noreferrer">
                      {result.pullRequestUrl}
                    </a>
                  ) : (
                    "n/a"
                  )}
                </dd>
              </dl>

              {result.pullRequestNumber ? <EditPrStatus prNumber={result.pullRequestNumber} /> : null}

              <div className="mc-files-actions" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
                {result.pullRequestUrl ? (
                  <a className="mc-btn mc-btn-sm mc-btn-soft" href={result.pullRequestUrl} target="_blank" rel="noreferrer">
                    View PR
                    <Icon.ExternalLink size={13} />
                  </a>
                ) : null}
                {argoUrl ? (
                  <a className="mc-btn mc-btn-sm mc-btn-soft" href={argoUrl} target="_blank" rel="noreferrer">
                    Open in ArgoCD
                    <Icon.ExternalLink size={13} />
                  </a>
                ) : null}
                <Link
                  className="mc-btn mc-btn-sm mc-btn-soft"
                  href={`/history/${encodeURIComponent(serviceName)}${result.pullRequestNumber ? `?pr=${result.pullRequestNumber}` : ""}`}
                >
                  Track in Delivery
                  <Icon.ChevronRight size={13} />
                </Link>
              </div>

              {argoUrl ? (
                <p className="mc-muted" style={{ fontSize: "0.76rem", margin: "0.65rem 0 0" }}>
                  Already merged? Hit <b>Refresh</b> (then <b>Sync</b>) in ArgoCD to roll the change out immediately.
                </p>
              ) : null}
            </div>
            <CodeBlock content={content.content} filename={content.path} />
          </>
        ) : (
          <>
            <p className="mc-muted" style={{ fontSize: "0.78rem", marginTop: 0 }}>
              <code>{content.path}</code> • {content.size} b{content.editable ? "" : " • read-only (platform-owned)"}
            </p>
            <CodeBlock content={content.content} filename={content.path} />
          </>
        )}
      </section>
    </div>
  );
}
