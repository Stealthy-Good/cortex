import { supabase } from '../db.js';

/**
 * Stale context cleanup: remove expired context for inactive contacts.
 * Schedule: Every 6 hours
 */
export async function staleContextCleanup(): Promise<void> {
  console.log('[Job: staleContextCleanup] Starting...');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Find stale contexts (generated more than 7 days ago)
  const { data: staleContexts } = await supabase
    .from('contact_context')
    .select('id, contact_id, tenant_id')
    .lt('generated_at', sevenDaysAgo.toISOString());

  if (!staleContexts?.length) {
    console.log('[Job: staleContextCleanup] No stale contexts found');
    return;
  }

  console.log(`[Job: staleContextCleanup] Found ${staleContexts.length} stale contexts`);

  for (const ctx of staleContexts) {
    // Check if the contact is still active
    const { data: contact } = await supabase
      .from('contacts')
      .select('last_touch_at')
      .eq('id', ctx.contact_id)
      .single();

    const lastTouch = contact?.last_touch_at ? new Date(contact.last_touch_at) : null;
    const isInactive = !lastTouch || lastTouch < thirtyDaysAgo;

    if (isInactive) {
      // Delete stale context for inactive contacts (regenerated on demand)
      await supabase.from('contact_context').delete().eq('id', ctx.id);
    }
    // Active contacts with stale context will be refreshed by nightlyContextRefresh
  }

  console.log('[Job: staleContextCleanup] Complete');
}
