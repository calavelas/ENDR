"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import {
  defaultPersona,
  type AssistantPersona,
  type AssistantRequest,
  type AssistantResponse,
} from "../../lib/assistant";
import { useNarrative } from "../../lib/narrative";
import { AssistantLauncher } from "./assistant-launcher";
import { AssistantPanel } from "./assistant-panel";

const K_OPEN = "endr-assistant-open";
const K_PERSONA = "endr-assistant-persona";
const K_PINNED = "endr-assistant-persona-pinned";

const ACCENT: Record<AssistantPersona, string> = {
  tars: "#37d3c3",
  case: "#9aa7bd",
};

export function AssistantWidget() {
  const { mode } = useNarrative();
  const pathname = usePathname() || "/";

  // Render nothing until mounted — keeps the fixed overlay out of SSR and avoids
  // any hydration mismatch (mirrors NarrativeProvider's post-mount restore).
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [persona, setPersona] = useState<AssistantPersona>("case");
  const [pinned, setPinned] = useState(false);
  const [data, setData] = useState<AssistantResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const launcherRef = useRef<HTMLButtonElement>(null);
  const stepRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);

  const runAsk = useCallback(async (req: AssistantRequest) => {
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
      });
      const json = (await res.json()) as AssistantResponse;
      stepRef.current = json.step;
      setData(json);
    } catch {
      // /api/assistant always returns 200; ignore same-origin network blips.
    } finally {
      setLoading(false);
    }
  }, []);

  // send() is bound to the latest render values and exposed via a ref, so effects
  // can call it without listing it (or its inputs) as dependencies.
  const send = (intent: string, replyId?: string) =>
    runAsk({ persona, mode, route: pathname, step: stepRef.current, intent, replyId });
  const sendRef = useRef(send);
  sendRef.current = send;

  // Mount + restore preferences (never read window during render).
  useEffect(() => {
    setMounted(true);
    try {
      const storedPersona = window.localStorage.getItem(K_PERSONA);
      const isPinned = window.localStorage.getItem(K_PINNED) === "1";
      setPinned(isPinned);
      if (isPinned && (storedPersona === "tars" || storedPersona === "case")) {
        setPersona(storedPersona);
      } else {
        setPersona(defaultPersona(mode));
      }
      if (window.localStorage.getItem(K_OPEN) === "1") setOpen(true);
    } catch {
      // localStorage unavailable — keep defaults.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-track the narrative mode until the user explicitly pins a persona.
  useEffect(() => {
    if (!mounted || pinned) return;
    setPersona(defaultPersona(mode));
  }, [mode, pinned, mounted]);

  // Persist preferences.
  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(K_PERSONA, persona);
      window.localStorage.setItem(K_PINNED, pinned ? "1" : "0");
    } catch {
      // ignore
    }
  }, [persona, pinned, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(K_OPEN, open ? "1" : "0");
    } catch {
      // ignore
    }
  }, [open, mounted]);

  // Re-ask whenever the panel is open and persona / mode / route changes.
  // Switching persona here re-asks a *different* deployment — the live showcase.
  useEffect(() => {
    if (!mounted || !open) return;
    sendRef.current("open");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, persona, mode, pathname, mounted]);

  // Return focus to the launcher when the panel closes (but not on first mount).
  useEffect(() => {
    if (!mounted) return;
    if (!open && wasOpenRef.current) launcherRef.current?.focus();
    wasOpenRef.current = open;
  }, [open, mounted]);

  if (!mounted) return null;

  const accent = data?.accent ?? ACCENT[persona];
  const rootStyle = { "--asst-accent": accent } as CSSProperties;

  const choosePersona = (next: AssistantPersona) => {
    if (next === persona) return;
    setPinned(true);
    setPersona(next);
  };

  return (
    <div className="asst-root" style={rootStyle}>
      {open ? (
        <AssistantPanel
          data={data}
          loading={loading}
          persona={persona}
          onPersona={choosePersona}
          onReply={(id) => sendRef.current("quick-reply", id)}
          onClose={() => setOpen(false)}
        />
      ) : null}
      <AssistantLauncher
        ref={launcherRef}
        open={open}
        persona={persona === "tars" ? "TARS" : "CASE"}
        onClick={() => setOpen((value) => !value)}
      />
    </div>
  );
}
