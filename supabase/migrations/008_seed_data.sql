-- Insert default tenant
-- After running this, copy the tenant ID to your .env DEFAULT_TENANT_ID
INSERT INTO tenants (name, slug)
VALUES ('Default Tenant', 'default')
ON CONFLICT (slug) DO NOTHING;

-- Insert default agent configs for the default tenant
DO $$
DECLARE
  tid UUID;
BEGIN
  SELECT id INTO tid FROM tenants WHERE slug = 'default';

  INSERT INTO agent_config (tenant_id, agent, daily_token_budget, default_model, complex_task_model)
  VALUES
    (tid, 'luna',   100000, 'haiku', 'sonnet'),
    (tid, 'anna',   80000,  'haiku', 'sonnet'),
    (tid, 'mia',    100000, 'haiku', 'sonnet'),
    (tid, 'jasper', 80000,  'haiku', 'sonnet'),
    (tid, 'helios', 50000,  'haiku', 'sonnet')
  ON CONFLICT (tenant_id, agent) DO NOTHING;
END $$;
