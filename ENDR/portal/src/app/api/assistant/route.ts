import { NextRequest, NextResponse } from "next/server";

import {
  fallbackGuide,
  resolveAssistantBase,
  type AssistantPersona,
  type AssistantRequest,
} from "../../lib/assistant";

export const dynamic = "force-dynamic";

// The create-wizard sub-steps are tightly coupled to the portal and were added
// after the robot image — a deployed pod that predates them won't recognise the
// intent and will answer with some other step. When that happens, keep the live
// pod's identity (persona/accent/calibration) but graft the portal's always-in-
// sync sub-step content on top, so the dialog tracks the form even before the
// pod is redeployed. Self-heals: once the pod knows the step, this is a no-op.
function reconcileSubstep(live: Record<string, unknown>, payload: AssistantRequest) {
  const intent = typeof payload.intent === "string" ? payload.intent : "";
  if (!intent.startsWith("create-")) {
    return live;
  }
  if (live.step === intent) {
    return live; // pod is up to date — use its answer verbatim
  }
  const fb = fallbackGuide(payload);
  return {
    ...live,
    step: fb.step,
    message: fb.message,
    progress: fb.progress,
    cta: fb.cta,
    quickReplies: fb.quickReplies,
  };
}

// Forwards a guidance turn to the right robot pod (tars/case). Always responds
// 200: on any error/timeout (e.g. cluster-free local dev) it returns the lean
// baked-in fallback so the widget never has to handle failure. The short 4s
// timeout keeps the offline path feeling instant.
export async function POST(request: NextRequest) {
  let payload: AssistantRequest;
  try {
    payload = (await request.json()) as AssistantRequest;
  } catch {
    payload = { persona: "case", mode: "idp", route: "/", intent: "open" };
  }

  const persona: AssistantPersona = payload.persona === "tars" ? "tars" : "case";
  const endpoint = `${resolveAssistantBase(persona)}/api/guide`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`robot responded ${response.status}`);
    }
    const data = await response.json();
    return NextResponse.json({ ...reconcileSubstep(data, payload), source: "live" });
  } catch {
    return NextResponse.json(fallbackGuide(payload), { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
