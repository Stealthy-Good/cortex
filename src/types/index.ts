// Express augmentation
declare global {
  namespace Express {
    interface Request {
      tenantId: string;
      agentName?: string;
    }
  }
}

// ─── Database Entities ───

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

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

export interface ContactContext {
  id: string;
  tenant_id: string;
  contact_id: string;
  summary: string;
  key_facts: string[];
  current_status: string | null;
  recommended_tone: string | null;
  open_threads: unknown[];
  churn_risk_score: number | null;
  upsell_potential_score: number | null;
  risk_factors: string[] | null;
  opportunity_factors: string[] | null;
  last_handoff_id: string | null;
  last_handoff_summary: string | null;
  interaction_count_at_generation: number | null;
  generated_at: string;
  expires_at: string | null;
  token_count: number | null;
  created_at: string;
  updated_at: string;
}

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

export interface TokenUsage {
  id: string;
  tenant_id: string;
  agent: string;
  model: string;
  operation: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number | null;
  contact_id: string | null;
  interaction_id: string | null;
  created_at: string;
}

export interface AgentConfig {
  id: string;
  tenant_id: string;
  agent: string;
  max_input_tokens: number;
  max_output_tokens: number;
  daily_token_budget: number;
  default_model: string;
  complex_task_model: string;
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ─── API Types ───

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiList<T> {
  data: T[];
  count: number;
  limit: number;
  offset: number;
}

export interface TokenUsageInfo {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

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

export interface ClaudeSummaryResult {
  summary: string;
  key_points: string[];
  sentiment: string;
  intent: string;
}

export interface ClaudeContextResult {
  summary: string;
  key_facts: string[];
  current_status: string;
  recommended_tone: string;
}

// Valid agent names
export const VALID_AGENTS = ['luna', 'mia', 'anna', 'jasper', 'helios', 'human'] as const;
export type AgentName = typeof VALID_AGENTS[number];
