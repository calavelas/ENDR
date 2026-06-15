"use client";

import * as Icon from "../components/icons";
import type { EnvRow } from "../lib/service-entry";

interface ConfigEditorProps {
  serviceName: string;
  gatewayEnabled: boolean;
  imageOverride: string;
  envRows: EnvRow[];
  onEnvRowsChange: (rows: EnvRow[]) => void;
}

// Step-3 left pane: the structured `overrides` form. The raw YAML lives in the
// persistent right-hand pane (YamlPane) and stays in sync. Gateway + image are
// locked for the demo; env overrides are editable.
export function ConfigEditor({
  serviceName,
  gatewayEnabled,
  imageOverride,
  envRows,
  onEnvRowsChange,
}: ConfigEditorProps) {
  const updateRow = (index: number, patch: Partial<EnvRow>) =>
    onEnvRowsChange(envRows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeRow = (index: number) => onEnvRowsChange(envRows.filter((_, i) => i !== index));
  const addRow = () => onEnvRowsChange([...envRows, { key: "", value: "" }]);

  const host = serviceName.trim() || "<service>";

  return (
    <div className="wiz-form-fields">
      <div className="wiz-toggle">
        <label className="wiz-toggle-row">
          <input type="checkbox" checked={gatewayEnabled} disabled aria-disabled="true" readOnly />
          <span>Expose publicly (Gateway)</span>
        </label>
        <p className="wiz-hint">
          Serve at <code>https://{host}.calavelas.net</code>.
        </p>
      </div>

      <label className="wiz-field">
        <span className="wiz-label">Image override</span>
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
  );
}
