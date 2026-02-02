CREATE TABLE IF NOT EXISTS agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,

  -- Token Budgets
  max_input_tokens INT DEFAULT 2000,
  max_output_tokens INT DEFAULT 500,
  daily_token_budget INT DEFAULT 100000,

  -- Model Preferences
  default_model TEXT DEFAULT 'haiku',
  complex_task_model TEXT DEFAULT 'sonnet',

  -- Behavior
  config JSONB DEFAULT '{}',

  enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, agent)
);
