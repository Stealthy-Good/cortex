// All requests go through /api/cortex proxy route — API key stays server-side
const PROXY_BASE = "/api/cortex";

interface FetchOptions extends RequestInit {
  agent?: string;
}

async function cortexFetch(path: string, options: FetchOptions = {}) {
  const { agent, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(agent ? { "X-Agent-Name": agent } : {}),
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  const url = `${PROXY_BASE}?path=${encodeURIComponent(path)}`;

  const res = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API error: ${res.status}`);
  }

  return res.json();
}

// Contacts
export async function getContacts(params?: {
  search?: string;
  stage?: string;
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.stage) query.set("stage", params.stage);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  const qs = query.toString();
  return cortexFetch(`/api/v1/contacts${qs ? `?${qs}` : ""}`);
}

export async function getContact(id: string) {
  return cortexFetch(`/api/v1/contacts/${id}`);
}

// Interactions
export async function getInteractions(params?: {
  contact_id?: string;
  agent?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.contact_id) query.set("contact_id", params.contact_id);
  if (params?.agent) query.set("agent", params.agent);
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return cortexFetch(`/api/v1/interactions${qs ? `?${qs}` : ""}`);
}

// Context
export async function getContext(contactId: string) {
  return cortexFetch(`/api/v1/context/${contactId}`);
}

// Handoffs
export async function getPendingHandoffs() {
  return cortexFetch("/api/v1/handoffs/pending");
}

export async function updateHandoff(id: string, data: { status: string }) {
  return cortexFetch(`/api/v1/handoffs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// Usage
export async function getUsageSummary(params?: {
  period?: "day" | "week" | "month";
  agent?: string;
}) {
  const query = new URLSearchParams();
  if (params?.period) query.set("period", params.period);
  if (params?.agent) query.set("agent", params.agent);
  const qs = query.toString();
  return cortexFetch(`/api/v1/usage/summary${qs ? `?${qs}` : ""}`);
}

export async function getBudgetCheck(agent: string) {
  return cortexFetch(`/api/v1/usage/budget-check/${agent}`);
}

// Health
export async function getHealthDeep() {
  return cortexFetch("/health/deep");
}
