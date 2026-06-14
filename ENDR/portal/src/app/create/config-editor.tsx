"use client";

import * as Icon from "../components/icons";
import type { EnvRow } from "../lib/service-entry";

interface ConfigEditorProps {
  editorMode: "form" | "yaml";
  onSetEditorMode: (mode: "form" | "yaml") => void;
  serviceName: string;
  namespaceLabel: string;
  gatewayEnabled: boolean;
  onGatewayChange: (value: boolean) => void;
  imageOverride: string;
  onImageChange: (value: string) => void;
  envRows: EnvRow[];
  onEnvRowsChange: (rows: EnvRow[]) => void;
  yamlText: string;
  onYamlChange: (value: string) => void;
  onYamlBlur: () => void;
  onValidate: () => void;
  validating: boolean;
  yamlError: string;
  unknownKeysWarning: string;
}

// Step-3 editor: tune the service's `overrides` block either through structured
// fields (Form) or as raw YAML (the services.yaml entry) — kept in sync by the
// wizard container. Grounded in real IDP config-override editing.
export function ConfigEditor({
  editorMode,
  onSetEditorMode,
  serviceName,
  gatewayEnabled,
  onGatewayChange,
  imageOverride,
  onImageChange,
  envRows,
  onEnvRowsChange,
  yamlText,
  onYamlChange,
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
      <div className="wiz-editor-bar">
        <div className="mc-seg" role="group" aria-label="Editor mode">
          <button
            type="button"
            className={`mc-seg-opt${editorMode === "form" ? " on" : ""}`}
            onClick={() => onSetEditorMode("form")}
          >
            Form
          </button>
          <button
            type="button"
            className={`mc-seg-opt${editorMode === "yaml" ? " on" : ""}`}
            onClick={() => onSetEditorMode("yaml")}
          >
            YAML
          </button>
        </div>
        <span className="wiz-editor-hint">Edit the service&apos;s config overrides.</span>
      </div>

      {editorMode === "form" ? (
        <div className="wiz-form-fields">
          <div className="wiz-toggle">
            <label className="wiz-toggle-row">
              <input type="checkbox" checked={gatewayEnabled} onChange={(e) => onGatewayChange(e.target.checked)} />
              <span>Expose publicly (Gateway)</span>
            </label>
            <p className="wiz-hint">
              Serve at <code>https://{host}.calavelas.net</code>.
            </p>
          </div>

          <label className="wiz-field">
            Image override <span className="wiz-optional">optional</span>
            <input
              type="text"
              className="wiz-input mc-mono"
              value={imageOverride}
              onChange={(e) => onImageChange(e.target.value)}
              placeholder="leave blank to use the template default"
              autoComplete="off"
            />
            <span className="wiz-hint">Pin a specific image, e.g. <code>calavelas/endr-robot:latest</code>.</span>
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
      ) : (
        <div className="wiz-yaml">
          <textarea
            className="wiz-yaml-text mc-mono"
            spellCheck={false}
            value={yamlText}
            onChange={(e) => onYamlChange(e.target.value)}
            onBlur={onYamlBlur}
            aria-label="services.yaml entry"
          />
          <div className="wiz-yaml-actions">
            <button type="button" className="mc-btn mc-btn-sm mc-btn-soft" onClick={onValidate} disabled={validating}>
              {validating ? "Validating…" : "Validate"}
            </button>
            <span className="wiz-hint">Runs the same dry-run check the platform uses.</span>
          </div>
          {yamlError ? (
            <p className="form-error" role="alert">
              {yamlError}
            </p>
          ) : null}
        </div>
      )}

      {unknownKeysWarning ? <p className="wiz-warn">{unknownKeysWarning}</p> : null}
    </div>
  );
}
