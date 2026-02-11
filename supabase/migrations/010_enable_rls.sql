-- Enable Row Level Security on all public tables
-- The application uses the service_role key, which bypasses RLS,
-- so backend operations are unaffected. This blocks unauthorized
-- access via the anon key / PostgREST.

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoff_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;
