"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import type { AssistantPersona, AssistantResponse } from "../../lib/assistant";
import * as Icon from "../icons";
import { useTypewriter } from "./use-typewriter";

interface PanelProps {
  data: AssistantResponse | null;
  loading: boolean;
  collapsed: boolean;
  persona: AssistantPersona;
  onPersona: (persona: AssistantPersona) => void;
  onReply: (id: string) => void;
  onCollapse: () => void;
}

export function AssistantPanel({
  data,
  loading,
  collapsed,
  persona,
  onPersona,
  onReply,
  onCollapse,
}: PanelProps) {
  const collapseRef = useRef<HTMLButtonElement>(null);
  const { out, done } = useTypewriter(data?.message ?? "");

  // Move focus into the dialog when it becomes visible; Escape collapses it.
  // The panel stays mounted while collapsed (to preserve state), so guard on it.
  useEffect(() => {
    if (!collapsed) collapseRef.current?.focus();
  }, [collapsed]);
  useEffect(() => {
    if (collapsed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCollapse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCollapse, collapsed]);

  const malfunction = data?.state === "malfunction";
  const name = data?.persona ?? (persona === "tars" ? "TARS" : "CASE");

  return (
    <section
      className={`asst-panel${malfunction ? " asst-malfunction" : ""}${collapsed ? " asst-collapsed" : ""}`}
      role="dialog"
      aria-modal="false"
      aria-hidden={collapsed}
      aria-labelledby="asst-title"
    >
      <div className="asst-strip" />

      <header className="asst-header">
        <div className="asst-persona" role="group" aria-label="Assistant persona">
          <button
            type="button"
            className={`asst-persona-opt${persona === "tars" ? " on" : ""}`}
            aria-pressed={persona === "tars"}
            onClick={() => onPersona("tars")}
          >
            TARS
          </button>
          <button
            type="button"
            className={`asst-persona-opt${persona === "case" ? " on" : ""}`}
            aria-pressed={persona === "case"}
            onClick={() => onPersona("case")}
          >
            CASE
          </button>
        </div>
        <button
          ref={collapseRef}
          type="button"
          className="asst-close"
          aria-label="Minimize assistant"
          title="Minimize"
          tabIndex={collapsed ? -1 : undefined}
          onClick={onCollapse}
        >
          <Icon.ChevronRight size={16} />
        </button>
      </header>

      <div className="asst-body">
        <h2 id="asst-title" className="asst-name">
          {name}
          {data?.source === "fallback" ? <span className="asst-cached">cached</span> : null}
          {malfunction ? (
            <span className="asst-cached asst-cached-bad">malfunction</span>
          ) : null}
        </h2>

        <div className="asst-msg" aria-live="polite">
          {loading && !data ? (
            <span className="asst-typing">● ● ●</span>
          ) : (
            <>
              <span aria-hidden="true">
                {out}
                {!done ? <span className="asst-caret" /> : null}
              </span>
              <span className="asst-sr">{data?.message}</span>
            </>
          )}
        </div>

        {data?.code ? (
          <pre className="asst-code" aria-label="example config">
            {data.code}
          </pre>
        ) : null}
      </div>

      {data?.progress ? (
        <div className="asst-progress" aria-hidden="true">
          <span
            className="asst-progress-bar"
            style={{ width: `${(data.progress.index / data.progress.total) * 100}%` }}
          />
        </div>
      ) : null}

      {data?.cta || data?.quickReplies?.length ? (
        <div className="asst-foot">
          {data?.cta ? (
            <Link href={data.cta.href} className="asst-cta">
              {data.cta.label}
              <Icon.ArrowRight size={14} />
            </Link>
          ) : null}
          {data?.quickReplies?.length ? (
            <div className="asst-replies">
              {data.quickReplies.map((reply) => (
                <button
                  key={reply.id}
                  type="button"
                  className="asst-chip"
                  onClick={() => onReply(reply.id)}
                  disabled={loading}
                >
                  {reply.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
