export interface Contact {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  company_name?: string;
  phone?: string;
  stage: "prospect" | "qualified" | "opportunity" | "customer" | "churning" | "lost" | "recovered";
  source?: string;
  owner_agent?: string;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
  first_touch_at?: string;
  last_touch_at?: string;
  converted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  tenant_id: string;
  contact_id: string;
  agent?: string;
  type: string;
  direction: "inbound" | "outbound";
  subject?: string;
  raw_content?: string;
  summary?: string;
  sentiment?: string;
  key_points?: string[];
  intent?: string;
  token_count?: number;
  created_at: string;
}

export interface ContactContext {
  id: string;
  contact_id: string;
  summary: string;
  key_facts?: string[];
  current_status?: string;
  recommended_tone?: string;
  open_threads?: Record<string, unknown>;
  churn_risk_score?: number;
  upsell_potential_score?: number;
  risk_factors?: string[];
  opportunity_factors?: string[];
  interaction_count_at_generation?: number;
  generated_at: string;
  expires_at?: string;
}

export interface HandoffEvent {
  id: string;
  tenant_id: string;
  contact_id: string;
  from_agent: string;
  to_agent: string;
  reason: string;
  reason_detail?: string;
  context_summary?: string;
  suggested_action?: string;
  urgency: "low" | "normal" | "high" | "urgent";
  status: "pending" | "accepted" | "completed" | "rejected";
  accepted_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface UsageSummary {
  agent: string;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  operation_count: number;
}

export interface BudgetCheck {
  agent: string;
  daily_budget: number;
  used_today: number;
  remaining: number;
  percentage_used: number;
  over_budget: boolean;
}
