import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.CORTEX_API_URL || "http://localhost:3000";
const API_KEY = process.env.CORTEX_API_KEY || "";
const TENANT_ID = process.env.CORTEX_TENANT_ID || "";

export async function GET(request: NextRequest) {
  return proxyRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request);
}

async function proxyRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  // Only allow known API paths
  const allowedPrefixes = ["/api/v1/", "/health"];
  if (!allowedPrefixes.some((p) => path.startsWith(p))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 403 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
    "X-Tenant-ID": TENANT_ID,
  };

  const agentHeader = request.headers.get("X-Agent-Name");
  if (agentHeader) {
    headers["X-Agent-Name"] = agentHeader;
  }

  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.text();
    if (body) fetchOptions.body = body;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, fetchOptions);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach Cortex API" },
      { status: 502 }
    );
  }
}
