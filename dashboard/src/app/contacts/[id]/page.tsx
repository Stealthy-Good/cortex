import { supabase } from '@/lib/supabase';
import { formatDate, formatDateTime, stageBadgeColor, sentimentBadgeColor, timeAgo } from '@/lib/utils';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 15;

interface ContactDetailProps {
  params: { id: string };
}

async function getContactDetail(id: string) {
  const [
    { data: contact },
    { data: interactions },
    { data: context },
    { data: handoffs },
  ] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', id).single(),
    supabase.from('interactions').select('id, agent, type, direction, subject, summary, sentiment, intent, key_points, created_at').eq('contact_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('contact_context').select('*').eq('contact_id', id).single(),
    supabase.from('handoff_events').select('id, from_agent, to_agent, to_human_id, reason, context_summary, urgency, status, created_at').eq('contact_id', id).order('created_at', { ascending: false }).limit(10),
  ]);

  return { contact, interactions: interactions || [], context, handoffs: handoffs || [] };
}

export default async function ContactDetailPage({ params }: ContactDetailProps) {
  const { contact, interactions, context, handoffs } = await getContactDetail(params.id);

  if (!contact) {
    notFound();
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/contacts" className="text-sm text-gray-500 hover:text-gray-700">&larr; Contacts</Link>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{contact.name || '(unnamed)'}</h1>
          <p className="text-sm text-gray-500">{contact.email}</p>
          {contact.company_name && (
            <p className="text-sm text-gray-700 mt-1">{contact.company_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${stageBadgeColor(contact.stage)}`}>{contact.stage}</span>
          {contact.owner_agent && (
            <span className="badge badge-purple">{contact.owner_agent}</span>
          )}
        </div>
      </div>

      {/* Contact Info + Context */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Contact Details */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact Details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Phone</dt>
              <dd className="text-gray-900">{contact.phone || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Source</dt>
              <dd className="text-gray-900">{contact.source || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">First Touch</dt>
              <dd className="text-gray-900">{formatDate(contact.first_touch_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Last Touch</dt>
              <dd className="text-gray-900">{formatDate(contact.last_touch_at)}</dd>
            </div>
            {contact.tags?.length > 0 && (
              <div>
                <dt className="text-gray-500 mb-1">Tags</dt>
                <dd className="flex flex-wrap gap-1">
                  {contact.tags.map((tag: string) => (
                    <span key={tag} className="badge badge-gray">{tag}</span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Working Context */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Working Context</h3>
            {context?.generated_at && (
              <span className="text-xs text-gray-400">
                Generated {timeAgo(context.generated_at)}
              </span>
            )}
          </div>
          {context ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">{context.summary}</p>
              {context.key_facts?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Key Facts</p>
                  <ul className="space-y-1">
                    {context.key_facts.map((fact: string, i: number) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5">&#8226;</span>
                        {fact}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <p className="text-sm text-gray-900">{context.current_status || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Recommended Tone</p>
                  <p className="text-sm text-gray-900">{context.recommended_tone || '-'}</p>
                </div>
              </div>
              {(context.churn_risk_score !== null || context.upsell_potential_score !== null) && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                  {context.churn_risk_score !== null && (
                    <div>
                      <p className="text-xs text-gray-500">Churn Risk</p>
                      <p className="text-sm font-medium text-gray-900">{context.churn_risk_score}/10</p>
                    </div>
                  )}
                  {context.upsell_potential_score !== null && (
                    <div>
                      <p className="text-xs text-gray-500">Upsell Potential</p>
                      <p className="text-sm font-medium text-gray-900">{context.upsell_potential_score}/10</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No context generated yet. Context is auto-generated when agents interact with this contact.</p>
          )}
        </div>
      </div>

      {/* Interaction Timeline */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Interaction Timeline</h2>
        <div className="space-y-3">
          {interactions.length === 0 ? (
            <p className="text-sm text-gray-500 card">No interactions recorded</p>
          ) : (
            interactions.map((interaction: any) => (
              <div key={interaction.id} className="card !p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge badge-purple">{interaction.agent}</span>
                      <span className="text-xs font-medium text-gray-700">{interaction.type}</span>
                      {interaction.direction && (
                        <span className="text-xs text-gray-500">({interaction.direction})</span>
                      )}
                      {interaction.sentiment && (
                        <span className={`badge ${sentimentBadgeColor(interaction.sentiment)}`}>
                          {interaction.sentiment}
                        </span>
                      )}
                      {interaction.intent && (
                        <span className="badge badge-blue">{interaction.intent}</span>
                      )}
                    </div>
                    {interaction.subject && (
                      <p className="mt-1 text-sm font-medium text-gray-800">{interaction.subject}</p>
                    )}
                    <p className="mt-1 text-sm text-gray-600">
                      {interaction.summary || '(no summary)'}
                    </p>
                    {interaction.key_points?.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {interaction.key_points.map((point: string, i: number) => (
                          <li key={i} className="text-xs text-gray-500">&#8226; {point}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                    {formatDateTime(interaction.created_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Handoff History */}
      {handoffs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Handoff History</h2>
          <div className="space-y-3">
            {handoffs.map((handoff: any) => (
              <div key={handoff.id} className="card !p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {handoff.from_agent} &rarr; {handoff.to_agent || 'human'}
                      </span>
                      <span className={`badge ${handoff.status === 'completed' ? 'badge-green' : handoff.status === 'pending' ? 'badge-yellow' : 'badge-gray'}`}>
                        {handoff.status}
                      </span>
                      <span className={`badge ${handoff.urgency === 'critical' ? 'badge-red' : handoff.urgency === 'high' ? 'badge-yellow' : 'badge-gray'}`}>
                        {handoff.urgency}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{handoff.reason}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDateTime(handoff.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
