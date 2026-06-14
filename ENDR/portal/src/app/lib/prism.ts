// Shared Prism instance + the languages we highlight in the portal (the YAML
// config editor and the create-flow file viewer). Imported only by client
// components. Pure highlight() helper — safe to call during render.
import Prism from "prismjs";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-json";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-docker";
import "prismjs/components/prism-markdown";

export function languageFromFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("dockerfile")) return "docker";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".sh") || lower.endsWith(".bash")) return "bash";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  return "";
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function highlight(code: string, language: string): string {
  const grammar = language ? Prism.languages[language] : undefined;
  if (!grammar) {
    return escapeHtml(code);
  }
  try {
    return Prism.highlight(code, grammar, language);
  } catch {
    return escapeHtml(code);
  }
}
