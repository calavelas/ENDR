"use client";

import { CodeEditor } from "../components/code-editor";

interface GeneratedFile {
  path: string;
  size: number;
  content?: string | null;
}

interface YamlPaneProps {
  yamlText: string;
  onYamlChange: (value: string) => void;
  onYamlFocus: () => void;
  onYamlBlur: () => void;
  onValidate: () => void;
  validating: boolean;
  yamlError: string;
  unknownKeysWarning: string;
  previewFiles: GeneratedFile[] | null;
  onOpenFile: (file: GeneratedFile) => void;
}

// The persistent right-hand pane: the live, editable services.yaml entry (every
// step just edits this file) plus the dry-run preview. Always visible so an
// engineer can edit the YAML and create directly.
export function YamlPane({
  yamlText,
  onYamlChange,
  onYamlFocus,
  onYamlBlur,
  onValidate,
  validating,
  yamlError,
  unknownKeysWarning,
  previewFiles,
  onOpenFile,
}: YamlPaneProps) {
  return (
    <aside className="wiz-yaml-pane">
      <div className="wiz-editor-col-head">
        <span>
          <code>services.yaml</code> entry
        </span>
        <button type="button" className="mc-btn mc-btn-sm mc-btn-soft" onClick={onValidate} disabled={validating}>
          {validating ? "Validating…" : "Validate"}
        </button>
      </div>

      <CodeEditor
        value={yamlText}
        onChange={onYamlChange}
        onFocus={onYamlFocus}
        onBlur={onYamlBlur}
        language="yaml"
        ariaLabel="services.yaml entry"
      />

      {yamlError ? (
        <p className="form-error" role="alert">
          {yamlError}
        </p>
      ) : (
        <p className="wiz-hint">Edit the form on the left or this YAML directly — they stay in sync.</p>
      )}
      {unknownKeysWarning ? <p className="wiz-warn">{unknownKeysWarning}</p> : null}

      <div className="wiz-pane-preview">
        <div className="mc-panel-head">
          <h3 className="mc-panel-title">Preview</h3>
          {previewFiles ? <span className="mc-count-chip">{previewFiles.length} files</span> : null}
        </div>
        {previewFiles ? (
          <ul className="wiz-file-list">
            {previewFiles.map((file) => (
              <li key={file.path}>
                <code>{file.path}</code>
                <span className="mc-muted">{file.size} b</span>
                {typeof file.content === "string" ? (
                  <button type="button" className="mc-link-all" onClick={() => onOpenFile(file)}>
                    View
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mc-muted wiz-preview-hint">Generate a preview to inspect the files before creating.</p>
        )}
      </div>
    </aside>
  );
}
