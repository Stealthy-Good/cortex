import { supabase } from '@/lib/supabase';
import { formatDateTime, urgencyBadgeColor, statusBadgeColor, timeAgo } from '@/lib/utils';
import Link from 'next/link';

export const revalidate = 15;

interface HandoffsPageProps {
  searchParams: { status?: string };
}

async function getHandoffs(statusFilter?: string) {
  let query = supabase
    .from('handoff_events')
    .select(`
      id, from_agent, to_agent, to_human_id, reason, reason_detail,
      context_summary, suggested_action, urgency, status,
      accepted_at, completed_at, contact_id, created_at
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) console.error('Error fetching handoffs:', error);
  return data || [];
}

async function getHandoffStats() {
  const [
    { count: pending },
    { count: accepted },
    { count: completed },
    { count: rejected },
  ] = await Promise.all([
    supabase.from('handoff_events').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('handoff_events').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
    supabase.from('handoff_events').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('handoff_events').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
  ]);

  return { pending: pending || 0, accepted: accepted || 0, completed: completed || 0, rejected: rejected || 0 };
}

const STATUSES = ['pending', 'accepted', 'completed', 'rejected'];

export default async function HandoffsPage({ searchParams }: HandoffsPageProps) {
  const [handoffs, stats] = await Promise.all([
    getHandoffs(searchParams.status),
    getHandoffStats(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Handoffs</h1>
        <p className="text-sm text-gray-500 mt-1">Agent-to-agent handoff coordination</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card !p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          <p className="text-xs text-gray-500">Pending</p>
        </div>
        <div className="card !p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.accepted}</p>
          <p className="text-xs text-gray-500">Accepted</p>
        </div>
        <div className="card !p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
        <div className="card !p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          <p className="text-xs text-gray-500">Rejected</p>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2">
        <Link
          href="/handoffs"
          className={`badge ${!searchParams.status ? 'bg-cortex-100 text-cortex-800' : 'badge-gray'} cursor-pointer`}
        >
          All
        </Link>
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={`/handoffs?status=${status}`}
            className={`badge ${searchParams.status === status ? 'bg-cortex-100 text-cortex-800' : statusBadgeColor(status)} cursor-pointer`}
          >
            {status}
          </Link>
        ))}
      </div>

      {/* Handoffs List */}
      <div className="space-y-3">
        {handoffs.length === 0 ? (
          <p className="text-sm text-gray-500 card text-center py-12">No handoffs found</p>
        ) : (
          handoffs.map((handoff: any) => (
            <div key={handoff.id} className="card !p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">
                      {handoff.from_agent} &rarr; {handoff.to_agent || `human (${handoff.to_human_id || 'unassigned'})`}
                    </span>
                    <span className={`badge ${statusBadgeColor(handoff.status)}`}>{handoff.status}</span>
                    <span className={`badge ${urgencyBadgeColor(handoff.urgency)}`}>{handoff.urgency}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-800">{handoff.reason}</p>
                  {handoff.reason_detail && (
                    <p className="mt-0.5 text-sm text-gray-600">{handoff.reason_detail}</p>
                  )}
                  {handoff.context_summary && (
                    <div className="mt-2 rounded-lg bg-gray-50 p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Context Summary</p>
                      <p className="text-sm text-gray-700">{handoff.context_summary}</p>
                    </div>
                  )}
                  {handoff.suggested_action && (
                    <p className="mt-2 text-sm text-cortex-700">
                      <span className="font-medium">Suggested action:</span> {handoff.suggested_action}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                    <span>Created {formatDateTime(handoff.created_at)}</span>
                    {handoff.accepted_at && <span>Accepted {formatDateTime(handoff.accepted_at)}</span>}
                    {handoff.completed_at && <span>Completed {formatDateTime(handoff.completed_at)}</span>}
                    {handoff.contact_id && (
                      <Link href={`/contacts/${handoff.contact_id}`} className="text-cortex-600 hover:text-cortex-700">
                        View contact &rarr;
                      </Link>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                  {timeAgo(handoff.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
