CREATE TABLE IF NOT EXISTS contact_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE UNIQUE,

  -- The Briefing
  summary TEXT NOT NULL,
  key_facts TEXT[] DEFAULT '{}',

  -- Current State
  current_status TEXT,
  recommended_tone TEXT,
  open_threads JSONB DEFAULT '[]',

  -- Risk/Opportunity Signals
  churn_risk_score FLOAT,
  upsell_potential_score FLOAT,
  risk_factors TEXT[],
  opportunity_factors TEXT[],

  -- Last Handoff Reference
  last_handoff_id UUID,
  last_handoff_summary TEXT,

  -- Cache Management
  interaction_count_at_generation INT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  -- Token Tracking
  token_count INT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_context_tenant ON contact_context(tenant_id);
CREATE INDEX IF NOT EXISTS idx_context_staleness ON contact_context(generated_at);
