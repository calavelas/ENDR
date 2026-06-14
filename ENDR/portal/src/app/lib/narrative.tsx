"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Two framings of the SAME platform. "idp" is the plain Internal Developer
// Platform vocabulary; "interstellar" is the gamified Interstellar narrative
// (Dashboard → Mission Control, Service → Robot, namespace → planet, cluster →
// Gargantua). Both are toggled live from the header — same data, same flow.
export type NarrativeMode = "idp" | "interstellar";

export interface NarrativeLabels {
  // Header / brand
  pageTitle: string; // Dashboard | Mission Control
  platformName: string; // Internal Developer Platform | Interstellar Development Platform
  profileRole: string;
  // Sidebar nav (only the two the user renamed change; the rest stay generic)
  nav: {
    dashboard: string;
    services: string;
  };
  // Welcome hero
  welcome: string;
  tagline: string;
  heroCopy: string;
  createCta: string;
  // Active services / missions section
  activeSection: string;
  modelLabel: string; // Template | Model
  namespaceLabel: string; // Namespace | Planet
  // Right rail
  statusPanelTitle: string; // Platform Status | Mission Status
  createCardTitle: string;
  createCardSub: string;
}

const LABELS: Record<NarrativeMode, NarrativeLabels> = {
  idp: {
    pageTitle: "Portal",
    platformName: "Internal Developer Platform",
    profileRole: "Platform Engineer",
    nav: { dashboard: "Portal", services: "Services" },
    welcome: "Welcome to ENDR",
    tagline: "Build. Operate. Evolve.",
    heroCopy: "Deploy reliable services with golden paths and automated operations.",
    createCta: "Create service",
    activeSection: "Services",
    modelLabel: "Template",
    namespaceLabel: "Namespace",
    statusPanelTitle: "Platform Status",
    createCardTitle: "Create a new service",
    createCardSub: "Start from a trusted template.",
  },
  interstellar: {
    pageTitle: "Mission Control",
    platformName: "Interstellar Development Platform",
    profileRole: "Mission Engineer",
    nav: { dashboard: "Mission Control", services: "Robots" },
    welcome: "Welcome to ENDR",
    tagline: "Build. Operate. Evolve.",
    heroCopy:
      "Deploy reliable services across the galaxy with golden paths and autonomous operations.",
    createCta: "Create robot",
    activeSection: "Active Missions",
    modelLabel: "Model",
    namespaceLabel: "Planet",
    statusPanelTitle: "Station Status",
    createCardTitle: "Create a new robot service",
    createCardSub: "Start a new mission with a trusted template.",
  },
};

// ── Interstellar mappings ──────────────────────────────────────────────────
// Namespaces become planets; the cluster becomes Gargantua.
const PLANETS = ["Miller", "Mann", "Edmunds", "Brand", "Romilly", "Doyle", "Cooper Station"];
const NAMESPACE_PLANETS: Record<string, string> = {
  miller: "Miller",
  mann: "Mann",
  edmunds: "Edmunds",
  // legacy demo namespaces, kept so older services still map to a planet
  demo: "Miller",
  demo2: "Mann",
  default: "Edmunds",
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function planetForNamespace(namespace: string): string {
  const key = namespace.trim().toLowerCase();
  return NAMESPACE_PLANETS[key] ?? PLANETS[hashString(key) % PLANETS.length];
}

export function environmentLabel(namespace: string, mode: NarrativeMode): string {
  return mode === "interstellar" ? planetForNamespace(namespace) : namespace;
}

export function clusterDisplay(name: string, mode: NarrativeMode): string {
  return mode === "interstellar" ? "Gargantua" : name;
}

// Platform (core) services renamed to fit the Interstellar theme — each name
// still hints at the real function (portal → Bridge, api → Flight Computer…).
const PLATFORM_INTERSTELLAR: Record<string, string> = {
  api: "Flight Computer",
  argocd: "Autopilot",
  cloudflare: "Uplink",
  core: "Reactor Core",
  gateway: "Airlock",
  platform: "Mainframe",
  portal: "Bridge",
  services: "Crew Modules",
  traefik: "Navigation",
};

function titleCase(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function platformServiceLabel(name: string, mode: NarrativeMode): string {
  if (mode !== "interstellar") {
    return name;
  }
  return PLATFORM_INTERSTELLAR[name.trim().toLowerCase()] ?? titleCase(name);
}

// ── The IDP delivery flow (one GitOps loop) ─────────────────────────────────
// Straight from DOCS/robot-demo-mockup.html: the same six-stage lifecycle,
// relabelled per narrative. `sub` is the constant SDLC mapping shown beneath.
export type StageId =
  | "declare"
  | "commit"
  | "validate"
  | "deliver"
  | "operate"
  | "retire";

export interface JourneyStage {
  id: StageId;
  label: string;
  sub: string;
}

const STAGE_DEFS: Array<{ id: StageId; idp: string; interstellar: string; sub: string }> = [
  { id: "declare", idp: "Declare", interstellar: "Design", sub: "Plan · Code" },
  { id: "commit", idp: "Commit", interstellar: "File spec", sub: "Code" },
  { id: "validate", idp: "Validate", interstellar: "Inspect", sub: "Test · CI" },
  { id: "deliver", idp: "Deliver", interstellar: "Assemble", sub: "Build · Deploy" },
  { id: "operate", idp: "Operate", interstellar: "Power on", sub: "Operate · Monitor" },
  { id: "retire", idp: "Retire", interstellar: "Decommission", sub: "Decommission" },
];

export function journeyStages(mode: NarrativeMode): JourneyStage[] {
  return STAGE_DEFS.map((stage) => ({
    id: stage.id,
    label: mode === "interstellar" ? stage.interstellar : stage.idp,
    sub: stage.sub,
  }));
}

export function stageIndex(id: StageId): number {
  return STAGE_DEFS.findIndex((stage) => stage.id === id);
}

// ── Context ────────────────────────────────────────────────────────────────
interface NarrativeContextValue {
  mode: NarrativeMode;
  setMode: (mode: NarrativeMode) => void;
  toggle: () => void;
  t: NarrativeLabels;
}

const NarrativeContext = createContext<NarrativeContextValue | null>(null);
const STORAGE_KEY = "endr-narrative-mode";

export function NarrativeProvider({ children }: { children: ReactNode }) {
  // Server + first client render use "idp" (no hydration mismatch); a stored
  // preference is applied right after mount.
  const [mode, setModeState] = useState<NarrativeMode>("idp");

  useEffect(() => {
    try {
      // A ?mode= query param wins (shareable demo links), then a stored choice.
      const fromUrl = new URLSearchParams(window.location.search).get("mode");
      if (fromUrl === "idp" || fromUrl === "interstellar") {
        setModeState(fromUrl);
        window.localStorage.setItem(STORAGE_KEY, fromUrl);
        return;
      }
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "idp" || stored === "interstellar") {
        setModeState(stored);
      }
    } catch {
      // localStorage / URL unavailable — keep the default.
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.narrative = mode;
  }, [mode]);

  const setMode = useCallback((next: NarrativeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore persistence failures.
    }
  }, []);

  const toggle = useCallback(() => {
    setModeState((current) => {
      const next = current === "idp" ? "interstellar" : "idp";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore persistence failures.
      }
      return next;
    });
  }, []);

  const value = useMemo<NarrativeContextValue>(
    () => ({ mode, setMode, toggle, t: LABELS[mode] }),
    [mode, setMode, toggle],
  );

  return <NarrativeContext.Provider value={value}>{children}</NarrativeContext.Provider>;
}

export function useNarrative(): NarrativeContextValue {
  const ctx = useContext(NarrativeContext);
  if (!ctx) {
    throw new Error("useNarrative must be used within a NarrativeProvider");
  }
  return ctx;
}
