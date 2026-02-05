-- 009: Cortex errors table for self-annealing system
-- Tracks operational errors, quality issues, and integration gaps
-- The self-anneal job reads patterns from here and auto-fixes recurring issues

CREATE TABLE cortex_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL,          -- 'api_error', 'claude_error', 'budget_exceeded', 'quality_issue', 'integration_gap'
  service TEXT NOT NULL,             -- 'contextService', 'claudeService', 'interactionService', etc.
  operation TEXT NOT NULL,           -- 'summarize_interaction', 'generate_context', 'budget_check', etc.
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB DEFAULT '{}',        -- request details, input data, affected contact/agent
  resolution TEXT,                   -- how it was fixed (filled in by self-anneal job)
  resolved_at TIMESTAMPTZ,
  pattern_id TEXT,                   -- groups recurring errors (e.g. 'claude_rate_limit', 'empty_summary')
  auto_fixed BOOLEAN DEFAULT FALSE,  -- whether the self-anneal job auto-resolved it
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for the self-anneal job: recent errors grouped by pattern
CREATE INDEX idx_cortex_errors_recent ON cortex_errors (created_at DESC);
CREATE INDEX idx_cortex_errors_pattern ON cortex_errors (pattern_id, created_at DESC) WHERE pattern_id IS NOT NULL;
CREATE INDEX idx_cortex_errors_unresolved ON cortex_errors (error_type, service, operation, created_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX idx_cortex_errors_tenant ON cortex_errors (tenant_id, created_at DESC);
