"use client";

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

// The "Files" tab: the service's GitOps source tree (from GitHub) + a viewer. The
// chart values.yaml is editable; saving opens a PR (Phase D — the FIX flow).
export function ServiceFilesTab({ serviceName, thing }: { serviceName: string; thing: string }) {
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
              <strong>Pull request opened</strong> — merge it and ArgoCD rolls out the change.
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
