// ─── Configuration ───

export interface CortexClientConfig {
  /** Base URL of the Cortex API (e.g. "http://localhost:3000" or "https://cortex.stealthygood.com") */
  baseUrl: string;
  /** Shared API key for authenticating with Cortex */
  apiKey: string;
  /** Tenant UUID for multi-tenant scoping */
  tenantId: string;
  /** Agent name sent via X-Agent-Name header (e.g. "luna", "anna") */
  agentName: string;
  /** Optional custom fetch implementation (defaults to global fetch) */
  fetch?: typeof fetch;
}

// ─── Agent Names ───

export const VALID_AGENTS = ['luna', 'mia', 'anna', 'jasper', 'helios', 'human'] as const;
export type AgentName = typeof VALID_AGENTS[number];

// ─── Contact ───

export interface Contact {
  id: string;
  tenant_id: string;
  email: string;
  name: string | null;
  company_name: string | null;
  phone: string | null;
  stage: string;
  source: string | null;
  owner_agent: string | null;
  owner_human_id: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  first_touch_at: string | null;
  last_touch_at: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateContactInput {
  email: string;
  name?: string;
  company_name?: string;
  phone?: string;
  stage?: string;
  source?: string;
  owner_agent?: string;
  owner_human_id?: string;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
}

export interface UpdateContactInput {
  name?: string;
  company_name?: string;
  phone?: string;
  stage?: string;
  source?: string;
  owner_agent?: string;
  owner_human_id?: string;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
}

export interface ListContactsFilters {
  stage?: string;
  owner_agent?: string;
  owner_human_id?: string;
  tag?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ContactListResult {
  contacts: Contact[];
  count: number;
  limit: number;
  offset: number;
}

// ─── Context ───

export interface ContextResponse {
  contact_id: string;
  level: number;
  token_count: number;
  header: {
    name: string | null;
    company: string | null;
    email: string;
    stage: string;
    last_touch: string | null;
    last_touch_agent: string | null;
  };
  context?: {
    summary: string;
    key_facts: string[];
    current_status: string | null;
    recommended_tone: string | null;
    open_threads: unknown[];
    signals: {
      churn_risk: number | null;
      upsell_potential: number | null;
      risk_factors: string[];
      opportunity_factors: string[];
    };
  };
  recent_interactions?: Array<{
    id: string;
    agent: string;
    type: string;
    summary: string | null;
    sentiment: string | null;
    date: string;
  }>;
  last_handoff?: {
    from: string;
    to: string | null;
    reason: string;
    date: string;
  } | null;
  generated_at: string | null;
  is_stale: boolean;
}

export interface RefreshResult {
  contact_id: string;
  regenerated: boolean;
  previous_generated_at: string | null;
  new_generated_at: string;
  token_count: number;
}

// ─── Interaction ───

export interface Interaction {
  id: string;
  tenant_id: string;
  contact_id: string;
  agent: string;
  human_id: string | null;
  type: string;
  direction: string | null;
  subject: string | null;
  raw_content: string | null;
  summary: string | null;
  sentiment: string | null;
  key_points: string[] | null;
  intent: string | null;
  external_id: string | null;
  campaign_id: string | null;
  thread_id: string | null;
  metadata: Record<string, unknown>;
  token_count: number | null;
  created_at: string;
}

export interface CreateInteractionInput {
  contact_id: string;
  agent: string;
  type: string;
  human_id?: string;
  direction?: 'inbound' | 'outbound';
  subject?: string;
  raw_content?: string;
  summary?: string;
  sentiment?: string;
  key_points?: string[];
  intent?: string;
  external_id?: string;
  campaign_id?: string;
  thread_id?: string;
  metadata?: Record<string, unknown>;
}

export interface InteractionResult {
  id: string;
  contact_id: string;
  summary: string | null;
  sentiment: string | null;
  key_points: string[] | null;
  intent: string | null;
  token_usage?: {
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
  };
  context_refresh_triggered: boolean;
}

export interface ListInteractionsFilters {
  agent?: string;
  type?: string;
  since?: string;
  limit?: number;
  include_raw?: boolean;
}

// ─── Handoff ───

export interface HandoffEvent {
  id: string;
  tenant_id: string;
  contact_id: string;
  from_agent: string;
  to_agent: string | null;
  to_human_id: string | null;
  reason: string;
  reason_detail: string | null;
  context_summary: string;
  suggested_action: string | null;
  urgency: string;
  status: string;
  accepted_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateHandoffInput {
  contact_id: string;
  from_agent: string;
  to_agent?: string;
  to_human_id?: string;
  reason: string;
  reason_detail?: string;
  suggested_action?: string;
  urgency?: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, unknown>;
}

export interface HandoffResult {
  id: string;
  contact_id: string;
  context_summary: string;
  status: string;
  context_refreshed: boolean;
}

export interface PendingHandoffsFilters {
  agent?: string;
  human_id?: string;
  urgency?: string;
}

// ─── Usage & Budget ───

export interface BudgetCheckResult {
  agent: string;
  daily_budget: number;
  used_today: number;
  remaining: number;
  estimated_tokens: number | null;
  within_budget: boolean;
  recommendation: 'proceed' | 'use_haiku' | 'defer' | 'alert_human';
  budget_percentage_used: number;
}

export interface UsageSummary {
  period: string;
  start: string;
  end: string;
  totals: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
  };
  by_agent: Record<
    string,
    { total_tokens: number; cost_usd: number; operations: number; avg_tokens_per_operation: number }
  >;
  by_model: Record<string, { tokens: number; cost_usd: number }>;
  budget_status: Record<string, { used: number; budget: number; remaining: number }>;
}

// ─── Health ───

export interface HealthCheckResult {
  status: string;
  timestamp: string;
  [key: string]: unknown;
}
