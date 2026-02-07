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
import { Button } from "@/components/ui/button";
import {
  ArrowRightLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { getPendingHandoffs, updateHandoff } from "@/lib/api";
import type { HandoffEvent } from "@/lib/types";

const URGENCY_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "warning"> = {
  urgent: "destructive",
  high: "warning",
  normal: "default",
  low: "secondary",
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  accepted: CheckCircle2,
  completed: CheckCircle2,
  rejected: XCircle,
};

export default function HandoffsPage() {
  const [handoffs, setHandoffs] = useState<HandoffEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadHandoffs();
  }, []);

  async function loadHandoffs() {
    setLoading(true);
    try {
      const res = await getPendingHandoffs();
      setHandoffs(res.data || []);
    } catch {
      setHandoffs([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusUpdate(id: string, status: string) {
    setUpdating(id);
    try {
      await updateHandoff(id, { status });
      await loadHandoffs();
    } catch {
      // silently fail, user can retry
    } finally {
      setUpdating(null);
    }
  }

  const urgentCount = handoffs.filter(
    (h) => h.urgency === "urgent" || h.urgency === "high"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Handoffs</h1>
          <p className="text-muted-foreground">
            Agent-to-agent transfer requests
          </p>
        </div>
        {urgentCount > 0 && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {urgentCount} urgent
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : handoffs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ArrowRightLeft className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium">No pending handoffs</p>
            <p className="text-sm text-muted-foreground">
              All agent transfers have been resolved
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {handoffs.map((handoff) => {
            const StatusIcon = STATUS_ICONS[handoff.status] || Clock;
            return (
              <Card
                key={handoff.id}
                className={
                  handoff.urgency === "urgent"
                    ? "border-destructive"
                    : handoff.urgency === "high"
                    ? "border-amber-400"
                    : ""
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary capitalize">
                          {handoff.from_agent?.[0]}
                        </span>
                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary capitalize">
                          {handoff.to_agent?.[0]}
                        </span>
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          <span className="capitalize">{handoff.from_agent}</span>
                          {" → "}
                          <span className="capitalize">{handoff.to_agent}</span>
                        </CardTitle>
                        <CardDescription>
                          {new Date(handoff.created_at).toLocaleString()}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={URGENCY_VARIANTS[handoff.urgency] || "secondary"}>
                        {handoff.urgency}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {handoff.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Reason</p>
                    <p className="text-sm text-muted-foreground">{handoff.reason}</p>
                    {handoff.reason_detail && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {handoff.reason_detail}
                      </p>
                    )}
                  </div>

                  {handoff.context_summary && (
                    <div>
                      <p className="text-sm font-medium">Context</p>
                      <p className="text-sm text-muted-foreground">
                        {handoff.context_summary}
                      </p>
                    </div>
                  )}

                  {handoff.suggested_action && (
                    <div>
                      <p className="text-sm font-medium">Suggested Action</p>
                      <p className="text-sm text-muted-foreground">
                        {handoff.suggested_action}
                      </p>
                    </div>
                  )}

                  {handoff.status === "pending" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleStatusUpdate(handoff.id, "accepted")}
                        disabled={updating === handoff.id}
                      >
                        {updating === handoff.id ? "Updating..." : "Accept"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusUpdate(handoff.id, "completed")}
                        disabled={updating === handoff.id}
                      >
                        Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleStatusUpdate(handoff.id, "rejected")}
                        disabled={updating === handoff.id}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
