import { supabase } from '../db.js';

// ─── Types ───

export interface CortexError {
  id: string;
  tenant_id: string | null;
  error_type: string;
  service: string;
  operation: string;
  error_message: string;
  stack_trace: string | null;
  context: Record<string, unknown>;
  resolution: string | null;
  resolved_at: string | null;
  pattern_id: string | null;
  auto_fixed: boolean;
  created_at: string;
}

export interface LogErrorInput {
  tenant_id?: string;
  error_type: 'api_error' | 'claude_error' | 'budget_exceeded' | 'quality_issue' | 'integration_gap';
  service: string;
  operation: string;
  error_message: string;
  stack_trace?: string;
  context?: Record<string, unknown>;
  pattern_id?: string;
}

export interface ErrorPattern {
  error_type: string;
  service: string;
  operation: string;
  pattern_id: string | null;
  count: number;
  latest_message: string;
  first_seen: string;
  last_seen: string;
}

// ─── Core Functions ───

/**
 * Log an error to the cortex_errors journal.
 * Non-blocking: never throws, always logs to console on failure.
 */
export async function logError(input: LogErrorInput): Promise<void> {
  try {
    const { error } = await supabase.from('cortex_errors').insert({
      tenant_id: input.tenant_id || null,
      error_type: input.error_type,
      service: input.service,
      operation: input.operation,
      error_message: input.error_message,
      stack_trace: input.stack_trace || null,
      context: input.context || {},
      pattern_id: input.pattern_id || null,
    });

    if (error) {
      console.error('[ErrorService] Failed to log error to journal:', error);
    }
  } catch (err) {
    console.error('[ErrorService] Exception logging error:', err);
  }
}

/**
 * Get recent errors within a time window (default: last 4 hours).
 */
export async function getRecentErrors(hours: number = 4): Promise<CortexError[]> {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  const { data, error } = await supabase
    .from('cortex_errors')
    .select('*')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CortexError[];
}

/**
 * Get unresolved errors, grouped by type/service/operation to detect patterns.
 */
export async function getErrorPatterns(hours: number = 24): Promise<ErrorPattern[]> {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  const { data, error } = await supabase
    .from('cortex_errors')
    .select('error_type, service, operation, pattern_id, error_message, created_at')
    .gte('created_at', since.toISOString())
    .is('resolved_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Group errors by type+service+operation
  const groups = new Map<string, ErrorPattern>();

  for (const row of data || []) {
    const key = `${row.error_type}::${row.service}::${row.operation}`;
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
      if (row.created_at > existing.last_seen) {
        existing.last_seen = row.created_at;
        existing.latest_message = row.error_message;
      }
      if (row.created_at < existing.first_seen) {
        existing.first_seen = row.created_at;
      }
    } else {
      groups.set(key, {
        error_type: row.error_type,
        service: row.service,
        operation: row.operation,
        pattern_id: row.pattern_id,
        count: 1,
        latest_message: row.error_message,
        first_seen: row.created_at,
        last_seen: row.created_at,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

/**
 * Mark errors as resolved (by pattern or by individual IDs).
 */
export async function resolveErrors(opts: {
  pattern_id?: string;
  error_ids?: string[];
  resolution: string;
  auto_fixed?: boolean;
}): Promise<number> {
  const now = new Date().toISOString();

  let query = supabase
    .from('cortex_errors')
    .update({
      resolution: opts.resolution,
      resolved_at: now,
      auto_fixed: opts.auto_fixed ?? false,
    })
    .is('resolved_at', null);

  if (opts.pattern_id) {
    query = query.eq('pattern_id', opts.pattern_id);
  } else if (opts.error_ids?.length) {
    query = query.in('id', opts.error_ids);
  } else {
    return 0;
  }

  const { data, error } = await query.select('id');
  if (error) throw error;
  return data?.length || 0;
}

/**
 * Get error summary statistics for the dashboard.
 */
export async function getErrorSummary(hours: number = 24): Promise<{
  total: number;
  unresolved: number;
  auto_fixed: number;
  by_type: Record<string, number>;
  by_service: Record<string, number>;
  recurring_patterns: ErrorPattern[];
}> {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  const { data, error } = await supabase
    .from('cortex_errors')
    .select('*')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  const errors = (data || []) as CortexError[];

  const byType: Record<string, number> = {};
  const byService: Record<string, number> = {};
  let unresolved = 0;
  let autoFixed = 0;

  for (const err of errors) {
    byType[err.error_type] = (byType[err.error_type] || 0) + 1;
    byService[err.service] = (byService[err.service] || 0) + 1;
    if (!err.resolved_at) unresolved++;
    if (err.auto_fixed) autoFixed++;
  }

  const patterns = await getErrorPatterns(hours);
  const recurringPatterns = patterns.filter((p) => p.count >= 3);

  return {
    total: errors.length,
    unresolved,
    auto_fixed: autoFixed,
    by_type: byType,
    by_service: byService,
    recurring_patterns: recurringPatterns,
  };
}
