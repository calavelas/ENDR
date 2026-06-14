// Pure helpers that translate the create-wizard form state ⇄ a single
// `services.yaml` entry (YAML text). Used by the Step-3 config editor so the
// structured form and the raw YAML stay in sync. No React, no side effects.
import { dump, load } from "js-yaml";

export interface EnvRow {
  key: string;
  value: string;
}

export interface ServiceFormState {
  serviceName: string;
  namespace: string;
  environment: string;
  serviceTemplate: string;
  gitopsTemplate: string;
  gatewayEnabled: boolean;
  imageOverride: string;
  envRows: EnvRow[];
}

// Override keys the wizard understands; anything else in the YAML is flagged so
// the user knows it won't be submitted (the create POST only carries these).
const KNOWN_OVERRIDE_KEYS = new Set(["gateway", "image", "env"]);

export function envRowsToMap(rows: EnvRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key) {
      out[key] = row.value;
    }
  }
  return out;
}

// Build the services.yaml entry object from the form. Mirrors the shape the
// backend/engine expects (see services.yaml + helm-service template).
export function buildEntry(form: ServiceFormState): Record<string, unknown> {
  const overrides: Record<string, unknown> = {
    gateway: { enabled: form.gatewayEnabled },
  };
  const image = form.imageOverride.trim();
  if (image) {
    overrides.image = image;
  }
  const env = envRowsToMap(form.envRows);
  if (Object.keys(env).length > 0) {
    overrides.env = env;
  }

  return {
    name: form.serviceName.trim() || "service",
    namespace: form.namespace,
    environments: form.environment ? [form.environment] : [],
    generator: {
      service: { template: form.serviceTemplate },
      gitops: { template: form.gitopsTemplate },
    },
    overrides,
  };
}

// Serialize a single entry as a `- name: …` list item, matching services.yaml.
export function entryToYaml(entry: Record<string, unknown>): string {
  return dump([entry], { lineWidth: 100, noRefs: true });
}

// Calibration keys left commented in a robot's YAML — an easter egg: an advanced
// user uncomments them in the editor to bring the robot ONLINE.
const ROBOT_COMMENTED_CALIBRATION = ["HUMOR", "HONESTY", "TRUST"];

export function formToYaml(form: ServiceFormState): string {
  let text = entryToYaml(buildEntry(form));
  if (form.serviceTemplate === "endr-robot") {
    const env = envRowsToMap(form.envRows);
    const missing = ROBOT_COMMENTED_CALIBRATION.filter((key) => !(key in env));
    if (missing.length > 0) {
      text = text.replace(/\n*$/, "\n");
      if (!/\n {4}env:/.test(text)) {
        text += "    env:\n";
      }
      text += "      # calibration — uncomment & set each 0-100 to bring it online:\n";
      text += `${missing.map((key) => `      # ${key}: ""`).join("\n")}\n`;
    }
  }
  return text;
}

export interface ParsedEntry {
  serviceName?: string;
  namespace?: string;
  environment?: string;
  serviceTemplate?: string;
  gitopsTemplate?: string;
  gatewayEnabled?: boolean;
  imageOverride: string;
  envRows: EnvRow[];
  unknownOverrideKeys: string[];
}

// Parse raw YAML (a single entry, or a one-item list) back into the fields the
// wizard tracks. Throws a friendly Error on malformed YAML / wrong shape.
export function parseYamlToForm(text: string): ParsedEntry {
  let doc: unknown;
  try {
    doc = load(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message.split("\n")[0] : "invalid YAML";
    throw new Error(`Invalid YAML: ${detail}`);
  }

  const entry = Array.isArray(doc) ? doc[0] : doc;
  if (!entry || typeof entry !== "object") {
    throw new Error("Config must be a single services.yaml entry (a YAML mapping).");
  }

  const e = entry as Record<string, unknown>;
  const generator = (e.generator ?? {}) as Record<string, unknown>;
  const serviceGen = (generator.service ?? {}) as Record<string, unknown>;
  const gitopsGen = (generator.gitops ?? {}) as Record<string, unknown>;
  const overrides = (e.overrides ?? {}) as Record<string, unknown>;
  const gateway = (overrides.gateway ?? {}) as Record<string, unknown>;
  const envObj =
    overrides.env && typeof overrides.env === "object" ? (overrides.env as Record<string, unknown>) : {};

  const envRows: EnvRow[] = Object.entries(envObj).map(([key, value]) => ({
    key,
    value: value == null ? "" : String(value),
  }));

  const environments = Array.isArray(e.environments) ? e.environments : [];

  return {
    serviceName: typeof e.name === "string" ? e.name : undefined,
    namespace: typeof e.namespace === "string" ? e.namespace : undefined,
    environment: typeof environments[0] === "string" ? environments[0] : undefined,
    serviceTemplate: typeof serviceGen.template === "string" ? serviceGen.template : undefined,
    gitopsTemplate: typeof gitopsGen.template === "string" ? gitopsGen.template : undefined,
    gatewayEnabled: typeof gateway.enabled === "boolean" ? gateway.enabled : undefined,
    imageOverride: typeof overrides.image === "string" ? overrides.image : "",
    envRows,
    unknownOverrideKeys: Object.keys(overrides).filter((key) => !KNOWN_OVERRIDE_KEYS.has(key)),
  };
}

// Suggested env overrides when the endr-robot template is chosen — these are
// just ordinary env keys, fully editable/removable (real-platform overrides).
export const ROBOT_ENV_SEED: EnvRow[] = [
  { key: "ROBOT_NAME", value: "" },
  { key: "CATCHPHRASE", value: "Are you ready for my robot colony?" },
];
