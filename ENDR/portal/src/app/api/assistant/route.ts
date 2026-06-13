import { NextRequest, NextResponse } from "next/server";

import {
  fallbackGuide,
  resolveAssistantBase,
  type AssistantPersona,
  type AssistantRequest,
} from "../../lib/assistant";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ ...data, source: "live" });
  } catch {
    return NextResponse.json(fallbackGuide(payload), { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
