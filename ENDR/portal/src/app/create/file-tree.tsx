"use client";

import * as Icon from "../components/icons";

export interface TreeFile {
  path: string;
  size: number;
  content?: string | null;
}

interface TreeNode {
  name: string;
  file?: TreeFile;
  children: Map<string, TreeNode>;
}

function buildTree(files: TreeFile[]): TreeNode {
  const root: TreeNode = { name: "", children: new Map() };
  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, index) => {
      let child = node.children.get(part);
      if (!child) {
        child = { name: part, children: new Map() };
        node.children.set(part, child);
      }
      if (index === parts.length - 1) {
        child.file = file;
      }
      node = child;
    });
  }
  return root;
}

function sortChildren(node: TreeNode): TreeNode[] {
  return [...node.children.values()].sort((a, b) => {
    const aDir = a.children.size > 0 ? 0 : 1;
    const bDir = b.children.size > 0 ? 0 : 1;
    if (aDir !== bDir) return aDir - bDir;
    return a.name.localeCompare(b.name);
  });
}

function Level({
  node,
  depth,
  onOpenFile,
  activePath,
  lazy,
}: {
  node: TreeNode;
  depth: number;
  onOpenFile: (file: TreeFile) => void;
  activePath?: string;
  lazy?: boolean;
}) {
  return (
    <>
      {sortChildren(node).map((child) => {
        const isDir = child.children.size > 0;
        const pad = { paddingLeft: `${depth * 0.95 + 0.5}rem` };
        if (isDir) {
          return (
            <div key={child.name}>
              <div className="wiz-tree-row wiz-tree-dir" style={pad}>
                <Icon.Layers size={13} />
                <span className="wiz-tree-name">{child.name}/</span>
              </div>
              <Level node={child} depth={depth + 1} onOpenFile={onOpenFile} activePath={activePath} lazy={lazy} />
            </div>
          );
        }
        const file = child.file!;
        const clickable = lazy || typeof file.content === "string";
        return (
          <button
            key={child.name}
            type="button"
            className={`wiz-tree-row wiz-tree-file${activePath === file.path ? " active" : ""}`}
            style={pad}
            onClick={() => clickable && onOpenFile(file)}
            disabled={!clickable}
            title={file.path}
          >
            <Icon.FileText size={13} />
            <span className="wiz-tree-name">{child.name}</span>
            <span className="wiz-tree-size">{file.size} b</span>
          </button>
        );
      })}
    </>
  );
}

// Renders the dry-run's generated files as a repo tree so the user sees where
// each file lands. Clicking a file opens it in the viewer.
export function FileTree({
  files,
  onOpenFile,
  activePath,
  lazy,
}: {
  files: TreeFile[];
  onOpenFile: (file: TreeFile) => void;
  activePath?: string;
  lazy?: boolean;
}) {
  if (files.length === 0) {
    return <p className="mc-muted">No files generated.</p>;
  }
  return (
    <div className="wiz-tree">
      <Level node={buildTree(files)} depth={0} onOpenFile={onOpenFile} activePath={activePath} lazy={lazy} />
    </div>
  );
}
