CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,

  -- Who/What
  agent TEXT NOT NULL,
  human_id TEXT,

  type TEXT NOT NULL,
  direction TEXT,

  -- Content
  subject TEXT,
  raw_content TEXT,
  summary TEXT,

  -- Analysis
  sentiment TEXT,
  key_points TEXT[],
  intent TEXT,

  -- References
  external_id TEXT,
  campaign_id TEXT,
  thread_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  token_count INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions(contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_tenant_agent ON interactions(tenant_id, agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_thread ON interactions(thread_id, created_at);
