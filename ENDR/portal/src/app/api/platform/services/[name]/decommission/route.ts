import { NextRequest, NextResponse } from "next/server";

import { resolveApiBase } from "../../../../../lib/platform";

export const dynamic = "force-dynamic";

// GET = eligibility, POST = open the decommission (destroy) PR. Proxies to the
// Python API (which holds GITHUB_TOKEN and enforces protection). Also reachable
// server-to-server from a robot pod's /api/self-destruct, avoiding cross-origin.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const endpoint = `${resolveApiBase()}/api/platform/services/${encodeURIComponent(name)}/decommission`;
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ detail: `unable to load decommission eligibility from ${endpoint}: ${detail}` }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const endpoint = `${resolveApiBase()}/api/platform/services/${encodeURIComponent(name)}/decommission`;
  try {
    const payload = await request.text().catch(() => "{}");
    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: payload || "{}",
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ detail: `unable to decommission service via ${endpoint}: ${detail}` }, { status: 502 });
  }
}
