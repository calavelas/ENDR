"use client";

import { CodeEditor } from "../components/code-editor";
import * as Icon from "../components/icons";
import type { EnvRow } from "../lib/service-entry";

interface ConfigEditorProps {
  serviceName: string;
  gatewayEnabled: boolean;
  imageOverride: string;
  envRows: EnvRow[];
  onEnvRowsChange: (rows: EnvRow[]) => void;
  onFormFocus: () => void;
  yamlText: string;
  onYamlChange: (value: string) => void;
  onYamlFocus: () => void;
  onYamlBlur: () => void;
  onValidate: () => void;
  validating: boolean;
  yamlError: string;
  unknownKeysWarning: string;
}

// Step-3 editor: structured override fields (left) beside the live, editable
// services.yaml entry (right) — both visible and kept in sync, like the mockup.
// The form is the source of truth; the YAML is a live projection you can also
// hand-edit (parsed back on blur). Gateway + image are locked for the demo.
export function ConfigEditor({
  serviceName,
  gatewayEnabled,
  imageOverride,
  envRows,
  onEnvRowsChange,
  onFormFocus,
  yamlText,
  onYamlChange,
  onYamlFocus,
  onYamlBlur,
  onValidate,
  validating,
  yamlError,
  unknownKeysWarning,
}: ConfigEditorProps) {
  const updateRow = (index: number, patch: Partial<EnvRow>) =>
    onEnvRowsChange(envRows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeRow = (index: number) => onEnvRowsChange(envRows.filter((_, i) => i !== index));
  const addRow = () => onEnvRowsChange([...envRows, { key: "", value: "" }]);

  const host = serviceName.trim() || "<service>";

  return (
    <div className="wiz-editor">
      <div className="wiz-editor-split">
        {/* Left — structured overrides */}
        <div className="wiz-editor-pane" onFocusCapture={onFormFocus}>
          <div className="wiz-editor-col-head">
            <span>Overrides — form</span>
          </div>

          <div className="wiz-toggle">
            <label className="wiz-toggle-row">
              <input type="checkbox" checked={gatewayEnabled} disabled aria-disabled="true" readOnly />
              <span>Expose publicly (Gateway)</span>
              <span className="wiz-lock">🔒 locked</span>
            </label>
            <p className="wiz-hint">
              Serve at <code>https://{host}.calavelas.net</code>. Always on for this demo.
            </p>
          </div>

          <label className="wiz-field">
            <span className="wiz-label">
              Image override <span className="wiz-optional">locked</span>
            </span>
            <input
              type="text"
              className="wiz-input mc-mono"
              value={imageOverride}
              placeholder="managed by the template"
              disabled
              aria-disabled="true"
              readOnly
              autoComplete="off"
            />
            <span className="wiz-hint">🔒 Pinned to the template default for this demo.</span>
          </label>

          <div className="wiz-env">
            <div className="wiz-env-head">
              <span>
                Environment variables <code>overrides.env</code>
              </span>
            </div>
            {envRows.length === 0 ? (
              <p className="wiz-hint">No env overrides. Add one to tune the running container.</p>
            ) : (
              envRows.map((row, index) => (
                <div className="wiz-env-row" key={index}>
                  <input
                    className="wiz-input mc-mono"
                    value={row.key}
                    onChange={(e) => updateRow(index, { key: e.target.value })}
                    placeholder="KEY"
                    aria-label="env key"
                    autoComplete="off"
                  />
                  <input
                    className="wiz-input"
                    value={row.value}
                    onChange={(e) => updateRow(index, { value: e.target.value })}
                    placeholder="value"
                    aria-label="env value"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="wiz-env-remove"
                    onClick={() => removeRow(index)}
                    aria-label="Remove variable"
                  >
                    <Icon.X size={14} />
                  </button>
                </div>
              ))
            )}
            <button type="button" className="mc-btn mc-btn-sm mc-btn-soft" onClick={addRow}>
              <Icon.Plus size={13} />
              Add variable
            </button>
          </div>
        </div>

        {/* Right — live YAML (editable) */}
        <div className="wiz-editor-pane">
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
            <p className="wiz-hint">Edit the form or this YAML — they stay in sync. Validate runs the dry-run check.</p>
          )}
        </div>
      </div>

      {unknownKeysWarning ? <p className="wiz-warn">{unknownKeysWarning}</p> : null}
    </div>
  );
}
