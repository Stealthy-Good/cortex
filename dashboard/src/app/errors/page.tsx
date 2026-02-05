import { supabase } from '@/lib/supabase';
import { formatDateTime, timeAgo } from '@/lib/utils';
import KpiCard from '@/components/KpiCard';

export const revalidate = 30;

async function getErrorData() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: recentErrors },
    { count: totalErrors },
    { count: unresolvedCount },
    { count: autoFixedCount },
  ] = await Promise.all([
    supabase
      .from('cortex_errors')
      .select('*')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('cortex_errors').select('id', { count: 'exact', head: true }).gte('created_at', twentyFourHoursAgo),
    supabase.from('cortex_errors').select('id', { count: 'exact', head: true }).is('resolved_at', null),
    supabase.from('cortex_errors').select('id', { count: 'exact', head: true }).eq('auto_fixed', true).gte('created_at', twentyFourHoursAgo),
  ]);

  // Group errors by type for patterns
  const errors = recentErrors || [];
  const byType: Record<string, number> = {};
  const byService: Record<string, number> = {};

  for (const err of errors) {
    byType[err.error_type] = (byType[err.error_type] || 0) + 1;
    byService[err.service] = (byService[err.service] || 0) + 1;
  }

  // Find recurring patterns (3+ occurrences)
  const patternCounts = new Map<string, { count: number; error_type: string; service: string; operation: string; latest_message: string }>();
  for (const err of errors) {
    const key = `${err.error_type}::${err.service}::${err.operation}`;
    const existing = patternCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      patternCounts.set(key, {
        count: 1,
        error_type: err.error_type,
        service: err.service,
        operation: err.operation,
        latest_message: err.error_message,
      });
    }
  }

  const recurringPatterns = Array.from(patternCounts.values())
    .filter((p) => p.count >= 3)
    .sort((a, b) => b.count - a.count);

  return {
    errors,
    total: totalErrors || 0,
    unresolved: unresolvedCount || 0,
    autoFixed: autoFixedCount || 0,
    byType,
    byService,
    recurringPatterns,
  };
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  api_error: 'badge-red',
  claude_error: 'badge-yellow',
  budget_exceeded: 'badge-purple',
  quality_issue: 'badge-blue',
  integration_gap: 'badge-gray',
};

export default async function ErrorsPage() {
  const data = await getErrorData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Self-Annealing Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Error tracking, pattern detection, and automatic fixes (last 24 hours)</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard title="Total Errors (24h)" value={data.total} />
        <KpiCard title="Unresolved" value={data.unresolved} subtitle={data.unresolved > 0 ? 'Needs attention' : 'All clear'} />
        <KpiCard title="Auto-Fixed" value={data.autoFixed} subtitle="By self-anneal job" />
        <KpiCard title="Recurring Patterns" value={data.recurringPatterns.length} subtitle="3+ occurrences" />
      </div>

      {/* Recurring Patterns */}
      {data.recurringPatterns.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recurring Patterns</h2>
          <div className="space-y-3">
            {data.recurringPatterns.map((pattern, i) => (
              <div key={i} className="card !p-4 border-l-4 border-l-red-400">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${ERROR_TYPE_COLORS[pattern.error_type] || 'badge-gray'}`}>
                        {pattern.error_type}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {pattern.service}.{pattern.operation}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">{pattern.latest_message}</p>
                  </div>
                  <span className="badge badge-red">{pattern.count}x</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">By Error Type</h3>
          {Object.keys(data.byType).length === 0 ? (
            <p className="text-sm text-gray-500">No errors in the last 24 hours</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data.byType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className={`badge ${ERROR_TYPE_COLORS[type] || 'badge-gray'}`}>{type}</span>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">By Service</h3>
          {Object.keys(data.byService).length === 0 ? (
            <p className="text-sm text-gray-500">No errors in the last 24 hours</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data.byService)
                .sort(([, a], [, b]) => b - a)
                .map(([service, count]) => (
                  <div key={service} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{service}</span>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Errors */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Errors</h2>
        <div className="space-y-3">
          {data.errors.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">No errors in the last 24 hours</p>
            </div>
          ) : (
            data.errors.map((error: any) => (
              <div
                key={error.id}
                className={`card !p-4 ${error.resolved_at ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`badge ${ERROR_TYPE_COLORS[error.error_type] || 'badge-gray'}`}>
                        {error.error_type}
                      </span>
                      <span className="text-xs font-medium text-gray-600">
                        {error.service}.{error.operation}
                      </span>
                      {error.auto_fixed && (
                        <span className="badge badge-green">auto-fixed</span>
                      )}
                      {error.resolved_at && !error.auto_fixed && (
                        <span className="badge badge-green">resolved</span>
                      )}
                      {error.pattern_id && (
                        <span className="badge badge-gray">{error.pattern_id}</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-700">{error.error_message}</p>
                    {error.resolution && (
                      <p className="mt-1 text-xs text-green-700">
                        Resolution: {error.resolution}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                    {timeAgo(error.created_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
