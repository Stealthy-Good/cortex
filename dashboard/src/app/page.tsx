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
import {
  Users,
  ArrowRightLeft,
  Zap,
  AlertTriangle,
  TrendingUp,
  Clock,
} from "lucide-react";
import { getContacts, getPendingHandoffs, getUsageSummary, getHealthDeep } from "@/lib/api";
import type { Contact, HandoffEvent, UsageSummary } from "@/lib/types";

interface KPI {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
}

export default function OverviewPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [handoffs, setHandoffs] = useState<HandoffEvent[]>([]);
  const [usage, setUsage] = useState<UsageSummary[]>([]);
  const [systemStatus, setSystemStatus] = useState<"healthy" | "degraded" | "down">("healthy");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [contactsRes, handoffsRes, usageRes, healthRes] =
          await Promise.allSettled([
            getContacts({ limit: 100 }),
            getPendingHandoffs(),
            getUsageSummary({ period: "day" }),
            getHealthDeep(),
          ]);

        if (contactsRes.status === "fulfilled") setContacts(contactsRes.value.data || []);
        if (handoffsRes.status === "fulfilled") setHandoffs(handoffsRes.value.data || []);
        if (usageRes.status === "fulfilled") setUsage(usageRes.value.data || []);
        if (healthRes.status === "fulfilled") {
          setSystemStatus(healthRes.value.status === "ok" ? "healthy" : "degraded");
        } else {
          setSystemStatus("degraded");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalTokensToday = usage.reduce((sum, u) => sum + (u.total_tokens || 0), 0);
  const totalCostToday = usage.reduce((sum, u) => sum + (u.cost_usd || 0), 0);
  const urgentHandoffs = handoffs.filter((h) => h.urgency === "urgent" || h.urgency === "high");
  const customerCount = contacts.filter((c) => c.stage === "customer").length;
  const activeStages = ["prospect", "qualified", "opportunity"];
  const pipelineCount = contacts.filter((c) => activeStages.includes(c.stage)).length;

  const kpis: KPI[] = [
    {
      title: "Total Contacts",
      value: contacts.length,
      description: `${customerCount} customers, ${pipelineCount} in pipeline`,
      icon: Users,
    },
    {
      title: "Pending Handoffs",
      value: handoffs.length,
      description: urgentHandoffs.length > 0 ? `${urgentHandoffs.length} urgent` : "None urgent",
      icon: ArrowRightLeft,
    },
    {
      title: "Tokens Today",
      value: totalTokensToday.toLocaleString(),
      description: `$${totalCostToday.toFixed(4)} cost`,
      icon: Zap,
    },
    {
      title: "System Status",
      value: systemStatus === "healthy" ? "Healthy" : "Degraded",
      description: systemStatus === "healthy" ? "All systems operational" : "Check health endpoint",
      icon: systemStatus === "healthy" ? TrendingUp : AlertTriangle,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Overview</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Overview</h1>
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium">Failed to load dashboard</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ensure the Cortex API is running and environment variables are configured.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Overview</h1>
        <Badge variant={systemStatus === "healthy" ? "success" : "warning"}>
          {systemStatus === "healthy" ? "System Healthy" : "System Degraded"}
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Summary + Recent Handoffs */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Agent Token Usage (Today)</CardTitle>
            <CardDescription>Daily token consumption by agent</CardDescription>
          </CardHeader>
          <CardContent>
            {usage.length === 0 ? (
              <p className="text-sm text-muted-foreground">No usage data for today</p>
            ) : (
              <div className="space-y-3">
                {usage.map((u) => (
                  <div key={u.agent} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {u.agent?.[0]?.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium capitalize">{u.agent}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">
                        {(u.total_tokens || 0).toLocaleString()}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ${(u.cost_usd || 0).toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Handoffs</CardTitle>
            <CardDescription>Agent-to-agent transfers awaiting action</CardDescription>
          </CardHeader>
          <CardContent>
            {handoffs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending handoffs</p>
            ) : (
              <div className="space-y-3">
                {handoffs.slice(0, 5).map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">
                          {h.from_agent}
                        </span>
                        <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium capitalize">
                          {h.to_agent}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{h.reason}</p>
                    </div>
                    <Badge
                      variant={
                        h.urgency === "urgent"
                          ? "destructive"
                          : h.urgency === "high"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {h.urgency}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contact Stage Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Pipeline</CardTitle>
          <CardDescription>Contacts by lifecycle stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {(
              ["prospect", "qualified", "opportunity", "customer", "churning", "lost", "recovered"] as const
            ).map((stage) => {
              const count = contacts.filter((c) => c.stage === stage).length;
              return (
                <div
                  key={stage}
                  className="flex items-center gap-2 rounded-md border px-4 py-2"
                >
                  <div
                    className={`h-2 w-2 rounded-full ${
                      stage === "customer"
                        ? "bg-emerald-500"
                        : stage === "churning"
                        ? "bg-amber-500"
                        : stage === "lost"
                        ? "bg-red-500"
                        : stage === "recovered"
                        ? "bg-blue-500"
                        : "bg-primary/50"
                    }`}
                  />
                  <span className="text-sm capitalize">{stage}</span>
                  <span className="text-sm font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
