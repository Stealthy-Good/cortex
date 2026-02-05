'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatTokens, formatCost, AGENT_COLORS } from '@/lib/utils';
import KpiCard from '@/components/KpiCard';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';

interface DailyUsage {
  date: string;
  tokens: number;
  cost: number;
}

interface AgentUsage {
  agent: string;
  tokens: number;
  cost: number;
  operations: number;
}

interface BudgetStatus {
  agent: string;
  used: number;
  budget: number;
  percentage: number;
}

export default function UsagePage() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [agentUsage, setAgentUsage] = useState<AgentUsage[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus[]>([]);
  const [totals, setTotals] = useState({ tokens: 0, cost: 0, operations: 0 });

  useEffect(() => {
    fetchData();
  }, [period]);

  async function fetchData() {
    const now = new Date();
    let start: Date;

    switch (period) {
      case 'day':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const { data: rows } = await supabase
      .from('token_usage')
      .select('agent, model, input_tokens, output_tokens, cost_usd, created_at')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: true });

    const records = rows || [];

    // Calculate totals
    let totalTokens = 0;
    let totalCost = 0;

    // Group by day
    const byDay = new Map<string, { tokens: number; cost: number }>();
    // Group by agent
    const byAgent = new Map<string, { tokens: number; cost: number; operations: number }>();

    for (const row of records) {
      const tokens = (row.input_tokens || 0) + (row.output_tokens || 0);
      const cost = Number(row.cost_usd) || 0;
      totalTokens += tokens;
      totalCost += cost;

      // Daily
      const day = new Date(row.created_at).toISOString().split('T')[0];
      const existing = byDay.get(day) || { tokens: 0, cost: 0 };
      existing.tokens += tokens;
      existing.cost += cost;
      byDay.set(day, existing);

      // Agent
      const agentData = byAgent.get(row.agent) || { tokens: 0, cost: 0, operations: 0 };
      agentData.tokens += tokens;
      agentData.cost += cost;
      agentData.operations += 1;
      byAgent.set(row.agent, agentData);
    }

    setTotals({ tokens: totalTokens, cost: totalCost, operations: records.length });
    setDailyUsage(
      Array.from(byDay.entries()).map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ...data,
      })),
    );
    setAgentUsage(
      Array.from(byAgent.entries())
        .map(([agent, data]) => ({ agent, ...data }))
        .sort((a, b) => b.tokens - a.tokens),
    );

    // Fetch budget configs
    const { data: configs } = await supabase
      .from('agent_config')
      .select('agent, daily_token_budget');

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const { data: todayRows } = await supabase
      .from('token_usage')
      .select('agent, input_tokens, output_tokens')
      .gte('created_at', todayStart);

    const todayByAgent = new Map<string, number>();
    for (const row of todayRows || []) {
      const tokens = (row.input_tokens || 0) + (row.output_tokens || 0);
      todayByAgent.set(row.agent, (todayByAgent.get(row.agent) || 0) + tokens);
    }

    setBudgetStatus(
      (configs || []).map((cfg: any) => ({
        agent: cfg.agent,
        used: todayByAgent.get(cfg.agent) || 0,
        budget: cfg.daily_token_budget,
        percentage: Math.round(((todayByAgent.get(cfg.agent) || 0) / cfg.daily_token_budget) * 100),
      })),
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usage</h1>
          <p className="text-sm text-gray-500 mt-1">Token consumption and budget tracking</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {(['day', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p ? 'bg-cortex-50 text-cortex-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard title="Total Tokens" value={formatTokens(totals.tokens)} subtitle={`${period} total`} />
        <KpiCard title="Total Cost" value={formatCost(totals.cost)} subtitle={`${period} spend`} />
        <KpiCard title="Operations" value={totals.operations} subtitle={`${period} API calls`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Daily Token Usage Line Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Token Usage Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyUsage}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatTokens(v)} />
              <Tooltip
                formatter={(value: number) => [formatTokens(value), 'Tokens']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Line type="monotone" dataKey="tokens" stroke="#4c6ef5" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Agent Distribution Pie Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Usage by Agent</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={agentUsage}
                dataKey="tokens"
                nameKey="agent"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ agent, percent }) => `${agent} (${(percent * 100).toFixed(0)}%)`}
              >
                {agentUsage.map((entry) => (
                  <Cell key={entry.agent} fill={AGENT_COLORS[entry.agent] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatTokens(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Cost by Day Bar Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Daily Cost</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyUsage}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v.toFixed(3)}`} />
              <Tooltip
                formatter={(value: number) => [formatCost(value), 'Cost']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="cost" fill="#4c6ef5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Budget Status */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Daily Budget Status</h3>
          <div className="space-y-4">
            {budgetStatus.length === 0 ? (
              <p className="text-sm text-gray-500">No agent configs found</p>
            ) : (
              budgetStatus.map((agent) => (
                <div key={agent.agent}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{agent.agent}</span>
                    <span className="text-xs text-gray-500">
                      {formatTokens(agent.used)} / {formatTokens(agent.budget)} ({agent.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        agent.percentage >= 90
                          ? 'bg-red-500'
                          : agent.percentage >= 70
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(agent.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Agent Breakdown Table */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent Breakdown</h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tokens</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Operations</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Avg/Op</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {agentUsage.map((agent) => (
                <tr key={agent.agent}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{agent.agent}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatTokens(agent.tokens)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatCost(agent.cost)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{agent.operations}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {agent.operations > 0 ? formatTokens(Math.round(agent.tokens / agent.operations)) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
