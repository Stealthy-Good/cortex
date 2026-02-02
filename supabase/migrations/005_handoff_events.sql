CREATE TABLE IF NOT EXISTS handoff_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,

  -- The Handoff
  from_agent TEXT NOT NULL,
  to_agent TEXT,
  to_human_id TEXT,

  -- Context
  reason TEXT NOT NULL,
  reason_detail TEXT,
  context_summary TEXT NOT NULL,
  suggested_action TEXT,

  -- Priority
  urgency TEXT DEFAULT 'normal',

  -- Status
  status TEXT DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handoffs_contact ON handoff_events(contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_handoffs_pending ON handoff_events(tenant_id, to_agent, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_handoffs_to_human ON handoff_events(tenant_id, to_human_id, status)
  WHERE to_human_id IS NOT NULL;
