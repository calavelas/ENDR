import { NextRequest, NextResponse } from "next/server";

import { resolveApiBase } from "../../../../../lib/platform";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const path = request.nextUrl.searchParams.get("path") ?? "";
  const endpoint = `${resolveApiBase()}/api/platform/services/${encodeURIComponent(name)}/file?path=${encodeURIComponent(path)}`;
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ detail: `unable to read service file from ${endpoint}: ${detail}` }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const endpoint = `${resolveApiBase()}/api/platform/services/${encodeURIComponent(name)}/file`;
  try {
    const payload = await request.text();
    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ detail: `unable to edit service file via ${endpoint}: ${detail}` }, { status: 502 });
  }
}
