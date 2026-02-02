CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  agent TEXT NOT NULL,
  model TEXT NOT NULL,
  operation TEXT NOT NULL,

  input_tokens INT NOT NULL,
  output_tokens INT NOT NULL,
  total_tokens INT GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

  cost_usd DECIMAL(10, 6),

  contact_id UUID REFERENCES contacts(id),
  interaction_id UUID REFERENCES interactions(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_tenant_agent ON token_usage(tenant_id, agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_daily ON token_usage(tenant_id, (created_at::date));
