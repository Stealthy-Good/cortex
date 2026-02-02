import { supabase } from '../db.js';

/**
 * Token budget reset: log daily usage summary.
 * Schedule: Midnight daily
 *
 * Note: Budgets are calculated dynamically from token_usage by date,
 * so no actual reset is needed. This job logs a daily summary.
 */
export async function tokenBudgetReset(): Promise<void> {
  console.log('[Job: tokenBudgetReset] Generating daily usage summary...');

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  const { data: tenants } = await supabase.from('tenants').select('id, name');
  if (!tenants?.length) return;

  for (const tenant of tenants) {
    const { data: usage } = await supabase
      .from('token_usage')
      .select('agent, input_tokens, output_tokens, cost_usd')
      .eq('tenant_id', tenant.id)
      .gte('created_at', `${dateStr}T00:00:00.000Z`)
      .lt('created_at', `${dateStr}T23:59:59.999Z`);

    if (!usage?.length) continue;

    const totalTokens = usage.reduce(
      (sum, r) => sum + (r.input_tokens || 0) + (r.output_tokens || 0),
      0,
    );
    const totalCost = usage.reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0);

    console.log(
      `[Job: tokenBudgetReset] Tenant "${tenant.name}" (${dateStr}): ${totalTokens} tokens, $${totalCost.toFixed(4)}, ${usage.length} operations`,
    );
  }

  console.log('[Job: tokenBudgetReset] Complete');
}
