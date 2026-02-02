CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identity
  email TEXT NOT NULL,
  name TEXT,
  company_name TEXT,
  phone TEXT,

  -- Classification
  stage TEXT NOT NULL DEFAULT 'prospect',
  source TEXT,

  -- Ownership
  owner_agent TEXT,
  owner_human_id TEXT,

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',

  -- Timestamps
  first_touch_at TIMESTAMPTZ,
  last_touch_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_stage ON contacts(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_owner ON contacts(tenant_id, owner_agent);
CREATE INDEX IF NOT EXISTS idx_contacts_last_touch ON contacts(tenant_id, last_touch_at DESC);
