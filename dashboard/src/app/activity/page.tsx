'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateTime, sentimentBadgeColor, statusBadgeColor, timeAgo } from '@/lib/utils';
import Link from 'next/link';

interface ActivityItem {
  id: string;
  type: 'interaction' | 'handoff';
  agent: string;
  summary: string;
  sentiment?: string | null;
  intent?: string | null;
  interaction_type?: string;
  from_agent?: string;
  to_agent?: string | null;
  urgency?: string;
  status?: string;
  contact_id?: string;
  created_at: string;
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    const [{ data: interactions }, { data: handoffs }] = await Promise.all([
      supabase
        .from('interactions')
        .select('id, agent, type, summary, sentiment, intent, contact_id, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('handoff_events')
        .select('id, from_agent, to_agent, reason, urgency, status, contact_id, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const activityItems: ActivityItem[] = [
      ...(interactions || []).map((i: any) => ({
        id: i.id,
        type: 'interaction' as const,
        agent: i.agent,
        summary: i.summary || '(no summary)',
        sentiment: i.sentiment,
        intent: i.intent,
        interaction_type: i.type,
        contact_id: i.contact_id,
        created_at: i.created_at,
      })),
      ...(handoffs || []).map((h: any) => ({
        id: h.id,
        type: 'handoff' as const,
        agent: h.from_agent,
        summary: h.reason,
        from_agent: h.from_agent,
        to_agent: h.to_agent,
        urgency: h.urgency,
        status: h.status,
        contact_id: h.contact_id,
        created_at: h.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setItems(activityItems);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchActivity();
    // Poll every 30 seconds
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Feed</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time stream of interactions and handoffs (auto-refreshes every 30s)</p>
        </div>
        <button
          onClick={fetchActivity}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">Loading activity...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No activity recorded yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={`${item.type}-${item.id}`} className="card !p-4">
              <div className="flex items-start gap-3">
                {/* Type indicator */}
                <div
                  className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${
                    item.type === 'interaction' ? 'bg-blue-400' : 'bg-orange-400'
                  }`}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.type === 'interaction' ? (
                      <>
                        <span className="badge badge-purple">{item.agent}</span>
                        <span className="text-xs font-medium text-gray-600">{item.interaction_type}</span>
                        {item.sentiment && (
                          <span className={`badge ${sentimentBadgeColor(item.sentiment)}`}>
                            {item.sentiment}
                          </span>
                        )}
                        {item.intent && <span className="badge badge-blue">{item.intent}</span>}
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-medium text-gray-900">
                          Handoff: {item.from_agent} &rarr; {item.to_agent || 'human'}
                        </span>
                        {item.status && (
                          <span className={`badge ${statusBadgeColor(item.status)}`}>{item.status}</span>
                        )}
                        {item.urgency && item.urgency !== 'normal' && (
                          <span className={`badge ${item.urgency === 'critical' || item.urgency === 'high' ? 'badge-red' : 'badge-yellow'}`}>
                            {item.urgency}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{item.summary}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                    <span>{timeAgo(item.created_at)}</span>
                    <span>{formatDateTime(item.created_at)}</span>
                    {item.contact_id && (
                      <Link href={`/contacts/${item.contact_id}`} className="text-cortex-600 hover:text-cortex-700">
                        View contact
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
