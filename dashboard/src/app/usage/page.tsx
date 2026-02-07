"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, DollarSign, AlertTriangle } from "lucide-react";
import { getUsageSummary, getBudgetCheck } from "@/lib/api";
import type { UsageSummary, BudgetCheck } from "@/lib/types";

const AGENTS = ["luna", "mia", "anna", "jasper", "helios"];

const AGENT_COLORS: Record<string, string> = {
  luna: "bg-violet-500",
  mia: "bg-blue-500",
  anna: "bg-emerald-500",
  jasper: "bg-amber-500",
  helios: "bg-red-500",
};

export default function UsagePage() {
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [usage, setUsage] = useState<UsageSummary[]>([]);
  const [budgets, setBudgets] = useState<BudgetCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [usageRes, ...budgetResults] = await Promise.allSettled([
          getUsageSummary({ period }),
          ...AGENTS.map((a) => getBudgetCheck(a)),
        ]);

        if (usageRes.status === "fulfilled") {
          setUsage(usageRes.value.data || []);
        }

        const budgetData: BudgetCheck[] = [];
        budgetResults.forEach((result, i) => {
          if (result.status === "fulfilled" && result.value.data) {
            budgetData.push(result.value.data);
          }
        });
        setBudgets(budgetData);
      } catch {
        setUsage([]);
        setBudgets([]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [period]);

  const totalTokens = usage.reduce((s, u) => s + (u.total_tokens || 0), 0);
  const totalCost = usage.reduce((s, u) => s + (u.cost_usd || 0), 0);
  const maxTokens = Math.max(...usage.map((u) => u.total_tokens || 0), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Usage</h1>
        <p className="text-muted-foreground">Token consumption and budget tracking</p>
      </div>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as "day" | "week" | "month")}>
        <TabsList>
          <TabsTrigger value="day">Today</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="space-y-6 mt-4">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : totalTokens.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {period === "day" ? "today" : period === "week" ? "this week" : "this month"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : `$${totalCost.toFixed(4)}`}
                </div>
                <p className="text-xs text-muted-foreground">Claude Haiku pricing</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : usage.length}
                </div>
                <p className="text-xs text-muted-foreground">of {AGENTS.length} agents</p>
              </CardContent>
            </Card>
          </div>

          {/* Token Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Token Usage by Agent</CardTitle>
              <CardDescription>
                Relative token consumption across the agent team
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {AGENTS.map((a) => (
                    <div key={a} className="h-8 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : usage.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No usage data for this period
                </p>
              ) : (
                <div className="space-y-4">
                  {AGENTS.map((agent) => {
                    const agentUsage = usage.find((u) => u.agent === agent);
                    const tokens = agentUsage?.total_tokens || 0;
                    const pct = (tokens / maxTokens) * 100;
                    return (
                      <div key={agent} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium capitalize">{agent}</span>
                          <span className="text-muted-foreground">
                            {tokens.toLocaleString()} tokens
                            {agentUsage?.cost_usd != null &&
                              ` ($${agentUsage.cost_usd.toFixed(4)})`}
                          </span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-muted">
                          <div
                            className={`h-3 rounded-full transition-all ${AGENT_COLORS[agent] || "bg-primary"}`}
                            style={{ width: `${Math.max(pct, tokens > 0 ? 2 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Budget Status */}
          <Card>
            <CardHeader>
              <CardTitle>Budget Status</CardTitle>
              <CardDescription>Daily token budget utilization per agent</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {AGENTS.map((a) => (
                    <div key={a} className="h-12 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : budgets.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No budget data available
                </p>
              ) : (
                <div className="space-y-4">
                  {budgets.map((budget) => {
                    const pctUsed = budget.percentage_used || 0;
                    return (
                      <div
                        key={budget.agent}
                        className="flex items-center gap-4 rounded-md border p-3"
                      >
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary capitalize">
                          {budget.agent?.[0]}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium capitalize">{budget.agent}</span>
                            <div className="flex items-center gap-2">
                              {budget.over_budget && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Over budget
                                </Badge>
                              )}
                              <span className="text-muted-foreground">
                                {(budget.used_today || 0).toLocaleString()} /{" "}
                                {(budget.daily_budget || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 h-2 w-full rounded-full bg-muted">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                pctUsed > 90
                                  ? "bg-red-500"
                                  : pctUsed > 70
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(pctUsed, 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-medium">
                          {pctUsed.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detailed Table */}
          {usage.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detailed Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Agent</th>
                        <th className="px-4 py-3 text-right font-medium">Input Tokens</th>
                        <th className="px-4 py-3 text-right font-medium">Output Tokens</th>
                        <th className="px-4 py-3 text-right font-medium">Total Tokens</th>
                        <th className="px-4 py-3 text-right font-medium">Cost</th>
                        <th className="px-4 py-3 text-right font-medium">Operations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.map((u) => (
                        <tr key={u.agent} className="border-b">
                          <td className="px-4 py-3 font-medium capitalize">{u.agent}</td>
                          <td className="px-4 py-3 text-right">
                            {(u.input_tokens || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(u.output_tokens || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {(u.total_tokens || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            ${(u.cost_usd || 0).toFixed(4)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {u.operation_count || 0}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/30 font-medium">
                        <td className="px-4 py-3">Total</td>
                        <td className="px-4 py-3 text-right">
                          {usage.reduce((s, u) => s + (u.input_tokens || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {usage.reduce((s, u) => s + (u.output_tokens || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {totalTokens.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          ${totalCost.toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {usage.reduce((s, u) => s + (u.operation_count || 0), 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
