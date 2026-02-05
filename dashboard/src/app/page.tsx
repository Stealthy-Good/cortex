import { supabase, supabaseReady } from '@/lib/supabase';
import { formatTokens, formatCost, timeAgo } from '@/lib/utils';
import KpiCard from '@/components/KpiCard';
import Link from 'next/link';

export const revalidate = 30;
export const dynamic = 'force-dynamic';

const EMPTY_DATA = {
  activeContacts: 0,
  todayInteractions: 0,
  pendingHandoffs: [] as any[],
  totalTokens: 0,
  totalCost: 0,
  recentInteractions: [] as any[],
  recentHandoffs: [] as any[],
  unresolvedErrors: 0,
};

async function getOverviewData() {
  if (!supabaseReady) return EMPTY_DATA;

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: activeContacts },
      { count: todayInteractions },
      { data: pendingHandoffs },
      { data: todayUsage },
      { data: recentInteractions },
      { data: recentHandoffs },
      { data: unresolvedErrors },
    ] = await Promise.all([
      supabase.from('contacts').select('id', { count: 'exact', head: true }).gte('last_touch_at', weekAgo),
      supabase.from('interactions').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('handoff_events').select('id, from_agent, to_agent, urgency, reason, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('token_usage').select('input_tokens, output_tokens, cost_usd').gte('created_at', todayStart),
      supabase.from('interactions').select('id, agent, type, summary, sentiment, created_at, contact_id').order('created_at', { ascending: false }).limit(8),
      supabase.from('handoff_events').select('id, from_agent, to_agent, status, urgency, reason, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('cortex_errors').select('id', { count: 'exact', head: true }).is('resolved_at', null),
    ]);

    const totalTokens = (todayUsage || []).reduce((sum, r) => sum + (r.input_tokens || 0) + (r.output_tokens || 0), 0);
    const totalCost = (todayUsage || []).reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0);

    return {
      activeContacts: activeContacts || 0,
      todayInteractions: todayInteractions || 0,
      pendingHandoffs: pendingHandoffs || [],
      totalTokens,
      totalCost,
      recentInteractions: recentInteractions || [],
      recentHandoffs: recentHandoffs || [],
      unresolvedErrors: unresolvedErrors || 0,
    };
  } catch (err) {
    console.error('[Dashboard] Failed to fetch overview data:', err);
    return EMPTY_DATA;
  }
}

export default async function OverviewPage() {
  const data = await getOverviewData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Cortex shared memory service dashboard</p>
      </div>

      {!supabaseReady && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">Supabase not configured</p>
          <p className="text-xs text-yellow-700 mt-0.5">
            Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in dashboard/.env.local to connect to your database.
            Showing empty state preview.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Active Contacts"
          value={data.activeContacts}
          subtitle="Touched in last 7 days"
        />
        <KpiCard
          title="Today's Interactions"
          value={data.todayInteractions}
          subtitle="Logged today"
        />
        <KpiCard
          title="Pending Handoffs"
          value={data.pendingHandoffs.length}
          subtitle={data.pendingHandoffs.length > 0 ? 'Needs attention' : 'All clear'}
        />
        <KpiCard
          title="Token Spend (Today)"
          value={formatTokens(data.totalTokens)}
          subtitle={formatCost(data.totalCost)}
        />
      </div>

      {/* Unresolved Errors Alert */}
      {(data.unresolvedErrors as number) > 0 && (
        <Link href="/errors" className="block">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-800">
                {data.unresolvedErrors} unresolved error{(data.unresolvedErrors as number) !== 1 ? 's' : ''} detected
              </p>
              <p className="text-xs text-red-600 mt-0.5">The self-annealing system is tracking these issues</p>
            </div>
            <span className="text-red-400 text-sm">View errors &rarr;</span>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <Link href="/activity" className="text-sm text-cortex-600 hover:text-cortex-700">
              View all &rarr;
            </Link>
          </div>
          <div className="space-y-3">
            {data.recentInteractions.length === 0 ? (
              <p className="text-sm text-gray-500 card">No recent interactions</p>
            ) : (
              data.recentInteractions.map((interaction: any) => (
                <div key={interaction.id} className="card !p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="badge badge-purple">{interaction.agent}</span>
                        <span className="text-xs text-gray-500">{interaction.type}</span>
                        {interaction.sentiment && (
                          <span className={`badge ${interaction.sentiment === 'positive' ? 'badge-green' : interaction.sentiment === 'negative' ? 'badge-red' : 'badge-gray'}`}>
                            {interaction.sentiment}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-700 truncate">
                        {interaction.summary || '(no summary)'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                      {timeAgo(interaction.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Handoffs */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Pending Handoffs</h2>
            <Link href="/handoffs" className="text-sm text-cortex-600 hover:text-cortex-700">
              View all &rarr;
            </Link>
          </div>
          <div className="space-y-3">
            {data.pendingHandoffs.length === 0 ? (
              <p className="text-sm text-gray-500 card">No pending handoffs</p>
            ) : (
              data.pendingHandoffs.map((handoff: any) => (
                <div key={handoff.id} className="card !p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {handoff.from_agent} &rarr; {handoff.to_agent || 'human'}
                        </span>
                        <span className={`badge ${handoff.urgency === 'high' || handoff.urgency === 'critical' ? 'badge-red' : 'badge-yellow'}`}>
                          {handoff.urgency}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{handoff.reason}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {timeAgo(handoff.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
