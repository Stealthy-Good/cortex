import { supabase } from '../db.js';
import type { BudgetCheckResult } from '../types/index.js';

export interface LogUsageInput {
  agent: string;
  model: string;
  operation: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  contact_id?: string;
  interaction_id?: string;
}

export async function logUsage(tenantId: string, input: LogUsageInput): Promise<void> {
  const { error } = await supabase.from('token_usage').insert({
    tenant_id: tenantId,
    agent: input.agent,
    model: input.model,
    operation: input.operation,
    input_tokens: input.input_tokens,
    output_tokens: input.output_tokens,
    cost_usd: input.cost_usd,
    contact_id: input.contact_id || null,
    interaction_id: input.interaction_id || null,
  });

  if (error) {
    console.error('[Usage] Failed to log usage:', error);
  }
}

export async function checkBudget(
  tenantId: string,
  agent: string,
  estimatedTokens?: number,
): Promise<BudgetCheckResult> {
  // Get agent config for budget
  const { data: agentConfig } = await supabase
    .from('agent_config')
    .select('daily_token_budget')
    .eq('tenant_id', tenantId)
    .eq('agent', agent)
    .single();

  const dailyBudget = agentConfig?.daily_token_budget ?? 100000;

  // Get today's usage
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const { data: usageRows } = await supabase
    .from('token_usage')
    .select('input_tokens, output_tokens')
    .eq('tenant_id', tenantId)
    .eq('agent', agent)
    .gte('created_at', `${today}T00:00:00.000Z`);

  const usedToday = (usageRows || []).reduce(
    (sum, row) => sum + (row.input_tokens || 0) + (row.output_tokens || 0),
    0,
  );

  const remaining = dailyBudget - usedToday;
  const percentUsed = Math.round((usedToday / dailyBudget) * 100);

  let recommendation: BudgetCheckResult['recommendation'] = 'proceed';
  if (remaining <= 0) {
    recommendation = 'defer';
  } else if (percentUsed >= 90) {
    recommendation = 'use_haiku';
  } else if (percentUsed >= 95) {
    recommendation = 'alert_human';
  }

  return {
    agent,
    daily_budget: dailyBudget,
    used_today: usedToday,
    remaining: Math.max(0, remaining),
    estimated_tokens: estimatedTokens ?? null,
    within_budget: remaining > (estimatedTokens || 0),
    recommendation,
    budget_percentage_used: percentUsed,
  };
}

export interface UsageSummary {
  period: string;
  start: string;
  end: string;
  totals: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
  };
  by_agent: Record<
    string,
    { total_tokens: number; cost_usd: number; operations: number; avg_tokens_per_operation: number }
  >;
  by_model: Record<string, { tokens: number; cost_usd: number }>;
  budget_status: Record<string, { used: number; budget: number; remaining: number }>;
}

export async function getUsageSummary(
  tenantId: string,
  period: 'day' | 'week' | 'month',
  agentFilter?: string,
): Promise<UsageSummary> {
  const now = new Date();
  let start: Date;

  switch (period) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      break;
  }

  let query = supabase
    .from('token_usage')
    .select('agent, model, input_tokens, output_tokens, cost_usd')
    .eq('tenant_id', tenantId)
    .gte('created_at', start.toISOString());

  if (agentFilter) query = query.eq('agent', agentFilter);

  const { data: rows } = await query;
  const records = rows || [];

  // Aggregate
  let totalInput = 0;
  let totalOutput = 0;
  let totalCost = 0;
  const byAgent: UsageSummary['by_agent'] = {};
  const byModel: UsageSummary['by_model'] = {};

  for (const row of records) {
    const inp = row.input_tokens || 0;
    const out = row.output_tokens || 0;
    const total = inp + out;
    const cost = Number(row.cost_usd) || 0;

    totalInput += inp;
    totalOutput += out;
    totalCost += cost;

    // By agent
    if (!byAgent[row.agent]) {
      byAgent[row.agent] = { total_tokens: 0, cost_usd: 0, operations: 0, avg_tokens_per_operation: 0 };
    }
    byAgent[row.agent].total_tokens += total;
    byAgent[row.agent].cost_usd += cost;
    byAgent[row.agent].operations += 1;

    // By model
    if (!byModel[row.model]) {
      byModel[row.model] = { tokens: 0, cost_usd: 0 };
    }
    byModel[row.model].tokens += total;
    byModel[row.model].cost_usd += cost;
  }

  // Calculate averages
  for (const agent of Object.keys(byAgent)) {
    const a = byAgent[agent];
    a.avg_tokens_per_operation = a.operations > 0 ? Math.round(a.total_tokens / a.operations) : 0;
    a.cost_usd = Math.round(a.cost_usd * 1_000_000) / 1_000_000;
  }
  for (const model of Object.keys(byModel)) {
    byModel[model].cost_usd = Math.round(byModel[model].cost_usd * 1_000_000) / 1_000_000;
  }

  // Get budget status for each agent
  const budgetStatus: UsageSummary['budget_status'] = {};
  const { data: configs } = await supabase
    .from('agent_config')
    .select('agent, daily_token_budget')
    .eq('tenant_id', tenantId);

  for (const cfg of configs || []) {
    const used = byAgent[cfg.agent]?.total_tokens || 0;
    budgetStatus[cfg.agent] = {
      used,
      budget: cfg.daily_token_budget,
      remaining: Math.max(0, cfg.daily_token_budget - used),
    };
  }

  return {
    period,
    start: start.toISOString(),
    end: now.toISOString(),
    totals: {
      input_tokens: totalInput,
      output_tokens: totalOutput,
      total_tokens: totalInput + totalOutput,
      cost_usd: Math.round(totalCost * 1_000_000) / 1_000_000,
    },
    by_agent: byAgent,
    by_model: byModel,
    budget_status: budgetStatus,
  };
}
