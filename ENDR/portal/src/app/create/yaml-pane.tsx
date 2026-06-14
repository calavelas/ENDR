"use client";

import { CodeEditor } from "../components/code-editor";

interface YamlPaneProps {
  yamlText: string;
  onYamlChange: (value: string) => void;
  onYamlFocus: () => void;
  onYamlBlur: () => void;
  onValidate: () => void;
  validating: boolean;
  yamlError: string;
  unknownKeysWarning: string;
}

// The persistent right-hand pane: the live, editable services.yaml entry (every
// step just edits this file). The file viewer renders beneath it; the dry-run
// preview list lives on the left under the step box.
export function YamlPane({
  yamlText,
  onYamlChange,
  onYamlFocus,
  onYamlBlur,
  onValidate,
  validating,
  yamlError,
  unknownKeysWarning,
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
    </aside>
  );
}
