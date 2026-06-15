"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useNarrative, type NarrativeLabels, type NarrativeMode } from "../lib/narrative";
import { useTheme, type ThemeMode } from "../lib/theme";
import { AssistantWidget } from "./assistant/assistant-widget";
import { AutoRefresh } from "./auto-refresh";
import * as Icon from "./icons";

function matchPath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface HeaderInfo {
  title: string;
  subtitle: string;
}

// The header title tracks the active route. The dashboard ("/") is the only
// fully-redesigned page; the rest show their section title here while their
// inner content is migrated in a later pass.
function resolveHeader(pathname: string, t: NarrativeLabels, mode: NarrativeMode): HeaderInfo {
  if (pathname === "/dashboard") {
    return { title: t.pageTitle, subtitle: t.platformName };
  }
  const routes: Array<{ prefix: string; idp: HeaderInfo; interstellar: HeaderInfo }> = [
    {
      prefix: "/catalog",
      idp: { title: "Service Catalog", subtitle: "Application & platform services" },
      interstellar: { title: "Robot Fleet", subtitle: "All deployed robots" },
    },
    {
      prefix: "/application-services",
      idp: { title: "Service", subtitle: "Application service detail" },
      interstellar: { title: "Robot", subtitle: "Robot detail" },
    },
    {
      prefix: "/platform-services",
      idp: { title: "Platform Service", subtitle: "Platform service detail" },
      interstellar: { title: "Subsystem", subtitle: "Platform subsystem detail" },
    },
    {
      prefix: "/create",
      idp: { title: "Create Service", subtitle: "New service from a template" },
      interstellar: { title: "Build a Robot", subtitle: "New mission from a blueprint" },
    },
    {
      prefix: "/history",
      idp: { title: "Delivery", subtitle: "Pull request & pipeline history" },
      interstellar: { title: "Mission Log", subtitle: "Delivery & pipeline history" },
    },
    {
      prefix: "/argocd",
      idp: { title: "Observability", subtitle: "ArgoCD operational view" },
      interstellar: { title: "Deep-Space Telemetry", subtitle: "ArgoCD operational view" },
    },
  ];
  const hit = routes.find((route) => matchPath(pathname, route.prefix));
  if (!hit) {
    return { title: t.pageTitle, subtitle: t.platformName };
  }
  return mode === "interstellar" ? hit.interstellar : hit.idp;
}

function NarrativeToggle({
  mode,
  setMode,
}: {
  mode: NarrativeMode;
  setMode: (mode: NarrativeMode) => void;
}) {
  return (
    <div className="nrt-toggle" role="group" aria-label="Narrative mode">
      <button
        type="button"
        className={`nrt-opt${mode === "idp" ? " on" : ""}`}
        onClick={() => setMode("idp")}
        aria-pressed={mode === "idp"}
      >
        IDP
      </button>
      <button
        type="button"
        className={`nrt-opt${mode === "interstellar" ? " on" : ""}`}
        onClick={() => setMode("interstellar")}
        aria-pressed={mode === "interstellar"}
      >
        Interstellar
      </button>
    </div>
  );
}

function ThemeToggle({ theme, toggle }: { theme: ThemeMode; toggle: () => void }) {
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="app-icon-btn"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {theme === "dark" ? <Icon.Sun /> : <Icon.Moon />}
    </button>
  );
}

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  soon?: boolean;
  isActive: (pathname: string) => boolean;
}

// Routes that render their own full-page chrome (landing, architecture, technical)
// — the app sidebar/header would only get in the way, so the shell steps aside and
// renders children directly. Providers stay mounted (they wrap AppShell), so the
// theme + narrative toggles still work on these pages.
const CHROMELESS_ROUTES = new Set(["/", "/architecture", "/technical"]);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const { mode, setMode, t } = useNarrative();
  const { theme, toggle: toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  if (CHROMELESS_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  const navItems: NavItem[] = [
    {
      key: "dashboard",
      label: t.nav.dashboard,
      href: "/dashboard",
      icon: <Icon.MissionControl />,
      isActive: (p) => p === "/dashboard",
    },
    {
      key: "services",
      label: t.nav.services,
      href: "/catalog",
      icon: <Icon.Cube />,
      isActive: (p) =>
        matchPath(p, "/catalog") ||
        matchPath(p, "/services") ||
        matchPath(p, "/application-services") ||
        matchPath(p, "/platform-services"),
    },
    { key: "templates", label: "Templates", href: "#", icon: <Icon.FileText />, soon: true, isActive: () => false },
    { key: "environments", label: "Environments", href: "#", icon: <Icon.Layers />, soon: true, isActive: () => false },
    {
      key: "delivery",
      label: "Delivery",
      href: "/history",
      icon: <Icon.Droplet />,
      isActive: (p) => matchPath(p, "/history"),
    },
    {
      key: "observability",
      label: "Observability",
      href: "/argocd",
      icon: <Icon.BarChart />,
      isActive: (p) => matchPath(p, "/argocd"),
    },
    { key: "activity", label: "Activity", href: "#", icon: <Icon.Activity />, soon: true, isActive: () => false },
    { key: "settings", label: "Settings", href: "#", icon: <Icon.Settings />, soon: true, isActive: () => false },
  ];

  const header = resolveHeader(pathname, t, mode);

  return (
    <div className={`app-shell${collapsed ? " collapsed" : ""}`}>
      <AutoRefresh />

      <div className="app-brand">
        <span className="app-brand-mark">ENDR</span>
      </div>

      <header className="app-header">
        <div className="app-header-title">
          <h1 className="app-title">{header.title}</h1>
          <p className="app-subtitle">{header.subtitle}</p>
        </div>
        <div className="app-header-actions">
          <NarrativeToggle mode={mode} setMode={setMode} />
          <ThemeToggle theme={theme} toggle={toggleTheme} />
          <Link href="/architecture" className="app-icon-btn" aria-label="Under the hood" title="Under the hood — how ENDR works">
            <Icon.HelpCircle />
          </Link>
          <button type="button" className="app-icon-btn" aria-label="Notifications">
            <Icon.Bell />
          </button>
        </div>
      </header>

      <aside className="app-sidebar">
        <nav className="app-nav" aria-label="Primary">
          {navItems.map((item) => {
            const active = item.isActive(pathname);
            const inner = (
              <>
                <span className="app-nav-icon">{item.icon}</span>
                <span className="app-nav-label">{item.label}</span>
                {item.soon ? <span className="app-nav-soon">soon</span> : null}
              </>
            );
            if (item.soon) {
              return (
                <span
                  key={item.key}
                  className="app-nav-link soon"
                  aria-disabled="true"
                  title="Coming soon"
                >
                  {inner}
                </span>
              );
            }
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`app-nav-link${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={item.label}
              >
                {inner}
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar-foot">
          <button
            type="button"
            className="app-collapse"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="app-nav-icon">
              <Icon.ChevronLeft />
            </span>
            <span className="app-nav-label">Collapse</span>
          </button>
          <span className="app-version">ENDR IDP v2.0.0</span>
        </div>
      </aside>

      <main className="app-content">{children}</main>

      <AssistantWidget />
    </div>
  );
}
