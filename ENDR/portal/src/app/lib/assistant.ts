// Contract + server helpers for the TARS / CASE guidance assistant.
//
// The rich, personality-driven guidance lives in the robot microservice
// (ENDR/engine/templates/service/endr-robot/image/journey.py). This module only:
//   1. defines the shared request/response types,
//   2. resolves which robot pod a persona maps to (server-only env), and
//   3. provides a LEAN baked-in fallback so the widget keeps working when the
//      cluster (or local robot) is unreachable — the cluster-free demo path.
//
// The fallback intentionally duplicates a *minimal* slice of journey.py's step
// graph. It is NOT meant to mirror the full personality engine — the backend is
// the source of truth. Do not try to DRY these into one module: they live in two
// languages and the fallback only needs to keep the offline tour walkable.

export type AssistantMode = "idp" | "interstellar";
export type AssistantPersona = "tars" | "case";

export interface AssistantQuickReply {
  id: string;
  label: string;
}

export interface AssistantCta {
  label: string;
  href: string;
}

export interface AssistantProgress {
  index: number;
  total: number;
}

export interface AssistantRequest {
  persona: AssistantPersona;
  mode: AssistantMode;
  route: string;
  step?: string | null;
  // open | next | back | help | restart | narrative | quick-reply
  intent: string;
  replyId?: string;
  context?: { servicesCount?: number; attention?: number };
}

export interface AssistantResponse {
  persona: string; // display name, e.g. "TARS"
  accent?: string; // optional; the widget falls back to the persona's colour
  calibrated: boolean;
  state: "online" | "malfunction";
  humor: number;
  honesty: number;
  trust: number;
  step: string;
  progress: AssistantProgress | null;
  message: string;
  code?: string | null;
  quickReplies: AssistantQuickReply[];
  cta: AssistantCta | null;
  source: "live" | "fallback";
}

// Default persona tracks the narrative: CASE (terse) in IDP, TARS (witty) in
// Interstellar. Mirrors the widget default so an offline answer matches the one
// the live pod would have given.
export function defaultPersona(mode: AssistantMode): AssistantPersona {
  return mode === "interstellar" ? "tars" : "case";
}

const PERSONA_META: Record<AssistantPersona, { name: string; accent: string }> = {
  tars: { name: "TARS", accent: "#37d3c3" },
  case: { name: "CASE", accent: "#9aa7bd" },
};

// Server-only: NOT NEXT_PUBLIC, so robot URLs never reach the browser (it always
// hits the same-origin /api/assistant proxy). Defaults point at the live robot
// services through the public gateway — CASE → case.endr.calavelas.net, TARS →
// tars.endr.calavelas.net (same `<service>.endr.calavelas.net` host the scaffold renders),
// so the widget talks to the running pods out of the box. For local dev against a
// robot on your machine, set ASSISTANT_CASE_URL / ASSISTANT_TARS_URL (e.g.
// http://127.0.0.1:8091). If the service is unreachable the proxy falls back to
// the baked-in cached guidance.
export function resolveAssistantBase(persona: AssistantPersona): string {
  const url =
    persona === "case"
      ? process.env.ASSISTANT_CASE_URL || "https://case.endr.calavelas.net"
      : process.env.ASSISTANT_TARS_URL || "https://tars.endr.calavelas.net";
  return url.replace(/\/+$/, "");
}

// ── Lean offline fallback ───────────────────────────────────────────────────
const ORDER = ["welcome", "create", "deploy", "catalog", "history", "done"];
// Sub-steps of the create wizard — the dialog mirrors the form as the user moves
// through them. Kept separate from ORDER so their progress reads 1/4…4/4.
const CREATE_SUBSTEPS = ["create-basics", "create-stack", "create-config", "create-review"];

type FallbackStep = {
  text: Record<AssistantMode, string>;
  cta: { href: string; label: Record<AssistantMode, string> } | null;
  replies: { id: string; label: string | Record<AssistantMode, string> }[];
};

const STEPS: Record<string, FallbackStep> = {
  welcome: {
    text: {
      idp: "Welcome to ENDR — your internal developer platform. Create services, ship them to the cluster, and watch their health from here. Want the quick tour?",
      interstellar: "Welcome to the bridge. ENDR is mission control for your fleet — build robots, launch them, and keep them online. Want the quick tour?",
    },
    cta: null,
    replies: [
      { id: "next", label: { idp: "Show me how to create a service", interstellar: "Show me how to build a robot" } },
      { id: "help", label: { idp: "What are you?", interstellar: "Who are you?" } },
    ],
  },
  create: {
    text: {
      idp: "Hit Create, pick a blueprint, name your service and namespace — ENDR scaffolds the repo, Dockerfile and Helm chart. No YAML by hand.",
      interstellar: "Open the build bay, pick a blueprint, name your robot and planet — ENDR forges the repo, Dockerfile and Helm chart. No YAML by hand.",
    },
    cta: { href: "/create", label: { idp: "Open Create", interstellar: "Open the build bay" } },
    replies: [
      { id: "next", label: { idp: "What happens next?", interstellar: "What happens next?" } },
      { id: "back", label: "Back" },
    ],
  },
  deploy: {
    text: {
      idp: "Creating a service opens a pull request — and it auto-merges once CI is green, so there's nothing to merge by hand. ArgoCD then syncs it and self-heals it. Give it a minute or two and it appears on the dashboard, healthy; watch the rollout under Observability.",
      interstellar: "Building a robot opens a pull request — and it auto-merges once inspection is green, so there's nothing to merge by hand. The autopilot (ArgoCD) then launches it and keeps it alive. Give it a minute or two and it shows up in the fleet, healthy; watch the launch under Telemetry.",
    },
    cta: { href: "/argocd", label: { idp: "Open Observability", interstellar: "Open telemetry" } },
    replies: [
      { id: "next", label: { idp: "Where do I see my services?", interstellar: "Where do I see the fleet?" } },
      { id: "back", label: "Back" },
    ],
  },
  catalog: {
    text: {
      idp: "Every service shows up in the Catalog with live status and health. Click one for its details, endpoint and revision.",
      interstellar: "Every robot shows up in the Fleet with live status and health. Click one for its details, endpoint and revision.",
    },
    cta: { href: "/catalog", label: { idp: "Open Catalog", interstellar: "Open the fleet" } },
    replies: [
      { id: "next", label: { idp: "How do I track changes?", interstellar: "How do I read the log?" } },
      { id: "back", label: "Back" },
    ],
  },
  history: {
    text: {
      idp: "Delivery keeps the full trail — every pull request and pipeline run that shipped a change. Your audit log of who changed what, when.",
      interstellar: "The Mission Log keeps the full trail — every pull request and pipeline run that shipped a change. Your record of who changed what, when.",
    },
    cta: { href: "/history", label: { idp: "Open Delivery", interstellar: "Open the mission log" } },
    replies: [
      { id: "next", label: "Is that the whole tour?" },
      { id: "back", label: "Back" },
    ],
  },
  done: {
    text: {
      idp: "That's the loop: create, deploy, observe, iterate. Go ship something.",
      interstellar: "That's the loop: build, launch, observe, iterate. Go ship something — the fleet's waiting.",
    },
    cta: { href: "/create", label: { idp: "Create a service", interstellar: "Build a robot" } },
    replies: [{ id: "restart", label: { idp: "Start over", interstellar: "Run it again" } }],
  },
  help: {
    text: {
      idp: "I'm a guide running as a real microservice in this cluster — there are two of us, TARS and CASE, one image and two deployments. (Right now the live pod is unreachable, so you're hearing cached guidance.)",
      interstellar: "I'm a microservice crewing this platform — two of us, TARS and CASE, one image and two deployments. (The live pod is unreachable right now, so this is cached guidance.)",
    },
    cta: null,
    replies: [{ id: "resume", label: "Back to the tour" }],
  },

  // ── Create-wizard sub-steps (the dialog tracks the form) ──────────────────
  "create-basics": {
    text: {
      idp: "Step 1 — the basics. Give your service a DNS-safe name (lowercase letters, numbers, dashes) and pick a namespace. That name becomes its address: <name>.endr.calavelas.net.",
      interstellar: "Step 1 — robot basics. Give your robot a call-sign (lowercase, numbers, dashes) and pick a planet to land on. The call-sign becomes its address: <name>.endr.calavelas.net.",
    },
    cta: null,
    replies: [],
  },
  "create-stack": {
    text: {
      idp: "Step 2 — the stack. Choose the target environment, a service template (the code scaffold) and a GitOps template (how it's packaged and deployed). The defaults are a fine starting point.",
      interstellar: "Step 2 — chassis & stack. Choose the target system, a blueprint (the chassis) and a delivery rig (how it's packaged and launched). The defaults are a fine starting point.",
    },
    cta: null,
    replies: [],
  },
  "create-config": {
    text: {
      idp: "Step 3 — configuration. These are the service's overrides: gateway, image and environment variables. It's a one-time Day-0 seed — after creation the service owns its config in its own GitOps repo. (Image is locked for the demo.)",
      interstellar: "Step 3 — calibration. This is the robot's overrides block: gateway, image and env. For a robot, set HUMOR / HONESTY / TRUST — leave them blank and it boots in MALFUNCTION. One-time Day-0 seed; after launch the robot owns its config in GitOps.",
    },
    cta: null,
    replies: [],
  },
  "create-review": {
    text: {
      idp: "Step 4 — review. On the left is the exact repo tree this will add; click any file to inspect it. Hit Create and the portal opens a pull request appending your service to services.yaml.",
      interstellar: "Step 4 — final checks. On the left is the exact repo tree this launch will add; click any file to inspect it. Hit Create and the portal opens a pull request appending your robot to services.yaml.",
    },
    cta: null,
    replies: [],
  },
  "create-submitted": {
    text: {
      idp: "Pull request opened — and it auto-merges itself once CI passes, so there's nothing for you to click. In a minute or two your new service appears on the dashboard, healthy. Don't see it yet? That's normal — the PR has to merge and ArgoCD has to sync; its own page may say 'not found' until then. Watch the dashboard.",
      interstellar: "Pull request away — and it auto-merges itself once inspection passes, so there's nothing for you to click. In a minute or two your robot shows up in the fleet, healthy. Don't see it yet? That's normal — the PR has to merge and the autopilot has to launch it; its page may say 'not found' until then. Watch the fleet.",
    },
    cta: { href: "/argocd", label: { idp: "Open Observability", interstellar: "Open telemetry" } },
    replies: [],
  },
};

const BANNER: Record<AssistantPersona, string> = {
  tars: "Comms link to the cluster is down — running on cached guidance. ",
  case: "Cluster comms unavailable. Using cached guidance. ",
};

function pick<T>(value: T | Record<AssistantMode, T>, mode: AssistantMode): T {
  if (value && typeof value === "object" && (mode in (value as object))) {
    return (value as Record<AssistantMode, T>)[mode];
  }
  return value as T;
}

function advance(step: string | null | undefined, delta: number): string {
  const i = step ? ORDER.indexOf(step) : -1;
  if (i === -1) return delta > 0 ? ORDER[0] : "welcome";
  return ORDER[Math.min(ORDER.length - 1, Math.max(0, i + delta))];
}

function routeToStep(route: string): string {
  if (!route || route === "/" || route === "/dashboard") return "welcome";
  if (route.startsWith("/create")) return "create";
  if (route.startsWith("/argocd")) return "deploy";
  if (route.startsWith("/history")) return "history";
  if (
    route.startsWith("/catalog") ||
    route.startsWith("/services") ||
    route.startsWith("/application-services") ||
    route.startsWith("/platform-services")
  ) {
    return "catalog";
  }
  return "welcome";
}

function targetFor(req: AssistantRequest): string {
  const { intent, replyId, step, route } = req;
  const act = intent === "quick-reply" && replyId ? replyId : intent;
  if (act === "resume") return step && ORDER.includes(step) ? step : "welcome";
  if (act === "next") return advance(step, 1);
  if (act === "back") return advance(step, -1);
  if (act === "restart") return "welcome";
  if (act === "help") return "help";
  if (act && STEPS[act]) return act;
  return routeToStep(route);
}

// Minimal offline mirror of the journey. Always returns 200-worthy data so the
// widget never has to special-case failure.
export function fallbackGuide(req: AssistantRequest): AssistantResponse {
  const mode: AssistantMode = req.mode === "interstellar" ? "interstellar" : "idp";
  const persona: AssistantPersona = req.persona === "tars" ? "tars" : "case";
  const meta = PERSONA_META[persona];

  const target = targetFor(req);
  const node = STEPS[target] ?? STEPS.welcome;
  let message = pick(node.text, mode);
  if ((req.intent ?? "open") === "open") {
    message = BANNER[persona] + message;
  }

  return {
    persona: meta.name,
    accent: meta.accent,
    calibrated: true,
    state: "online",
    humor: persona === "tars" ? 90 : 30,
    honesty: persona === "tars" ? 90 : 95,
    trust: persona === "tars" ? 70 : 90,
    step: target,
    progress: ORDER.includes(target)
      ? { index: ORDER.indexOf(target) + 1, total: ORDER.length }
      : CREATE_SUBSTEPS.includes(target)
        ? { index: CREATE_SUBSTEPS.indexOf(target) + 1, total: CREATE_SUBSTEPS.length }
        : null,
    message,
    quickReplies: node.replies.map((r) => ({ id: r.id, label: pick(r.label, mode) })),
    cta: node.cta ? { href: node.cta.href, label: pick(node.cta.label, mode) } : null,
    source: "fallback",
  };
}
