import { supabase } from '../db.js';
import * as contextService from '../services/contextService.js';

/**
 * Nightly context refresh: regenerate working context for active contacts.
 * Schedule: 2:00 AM daily
 */
export async function nightlyContextRefresh(): Promise<void> {
  console.log('[Job: nightlyContextRefresh] Starting...');

  // Get all tenants
  const { data: tenants } = await supabase.from('tenants').select('id');
  if (!tenants?.length) return;

  for (const tenant of tenants) {
    try {
      // Find active contacts (touched in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: contacts } = await supabase
        .from('contacts')
        .select('id')
        .eq('tenant_id', tenant.id)
        .gte('last_touch_at', thirtyDaysAgo.toISOString());

      if (!contacts?.length) continue;

      console.log(`[Job: nightlyContextRefresh] Tenant ${tenant.id}: ${contacts.length} active contacts`);

      // Process in batches of 10
      for (let i = 0; i < contacts.length; i += 10) {
        const batch = contacts.slice(i, i + 10);
        await Promise.allSettled(
          batch.map((c) =>
            contextService.refreshContext(tenant.id, c.id).catch((err) => {
              console.error(`[Job: nightlyContextRefresh] Failed for contact ${c.id}:`, err);
            }),
          ),
        );

        // Small delay between batches to avoid rate limits
        if (i + 10 < contacts.length) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    } catch (err) {
      console.error(`[Job: nightlyContextRefresh] Error for tenant ${tenant.id}:`, err);
    }
  }

  console.log('[Job: nightlyContextRefresh] Complete');
}
