import { supabase } from '../db.js';

/**
 * Handoff reminder: nudge on pending handoffs that are getting old.
 * Schedule: Every 2 hours
 */
export async function handoffReminder(): Promise<void> {
  console.log('[Job: handoffReminder] Checking pending handoffs...');

  const fourHoursAgo = new Date();
  fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  // Find pending handoffs older than 4 hours
  const { data: staleHandoffs } = await supabase
    .from('handoff_events')
    .select('id, tenant_id, contact_id, to_agent, to_human_id, urgency, created_at')
    .eq('status', 'pending')
    .lt('created_at', fourHoursAgo.toISOString());

  if (!staleHandoffs?.length) {
    console.log('[Job: handoffReminder] No stale handoffs');
    return;
  }

  for (const handoff of staleHandoffs) {
    const createdAt = new Date(handoff.created_at);
    const isOverdue = createdAt < twentyFourHoursAgo;
    const isHighPriority = handoff.urgency === 'high' || handoff.urgency === 'urgent';

    if (isHighPriority) {
      console.warn(
        `[Job: handoffReminder] REMINDER: High-priority handoff ${handoff.id} pending for ${handoff.to_agent || handoff.to_human_id} (created: ${handoff.created_at})`,
      );
    }

    if (isOverdue) {
      console.warn(
        `[Job: handoffReminder] ESCALATION: Handoff ${handoff.id} pending > 24h for ${handoff.to_agent || handoff.to_human_id}`,
      );
    }

    // Future: send webhook to Helios for dashboard notification
  }

  console.log(`[Job: handoffReminder] Processed ${staleHandoffs.length} stale handoffs`);
}
