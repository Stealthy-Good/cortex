-- Create a system contact for Helios security audit events.
-- All security validation logs are stored as interactions tied to this contact.
-- Copy the generated contact ID to Helios env as CORTEX_SECURITY_CONTACT_ID.

DO $$
DECLARE
  tid UUID;
  cid UUID;
BEGIN
  SELECT id INTO tid FROM tenants WHERE slug = 'default';

  INSERT INTO contacts (tenant_id, email, name, company_name, stage, source, owner_agent, tags)
  VALUES (
    tid,
    'security-system@internal.helios',
    'Helios Security System',
    'Internal',
    'customer',
    'system',
    'helios',
    ARRAY['system', 'security', 'do-not-delete']
  )
  ON CONFLICT (tenant_id, email) DO NOTHING
  RETURNING id INTO cid;

  IF cid IS NOT NULL THEN
    RAISE NOTICE 'Security system contact created with ID: %', cid;
    RAISE NOTICE 'Add to Helios .env: CORTEX_SECURITY_CONTACT_ID=%', cid;
  ELSE
    SELECT id INTO cid FROM contacts
    WHERE tenant_id = tid AND email = 'security-system@internal.helios';
    RAISE NOTICE 'Security system contact already exists with ID: %', cid;
  END IF;
END $$;
