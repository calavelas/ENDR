import { NextResponse } from "next/server";

import { resolveApiBase } from "../../../../../lib/platform";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const endpoint = `${resolveApiBase()}/api/platform/services/${encodeURIComponent(name)}/files`;
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ detail: `unable to load service files from ${endpoint}: ${detail}` }, { status: 502 });
  }
}
