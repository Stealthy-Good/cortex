"use client";

import { useEffect, useState, useCallback } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { getInteractions } from "@/lib/api";
import type { Interaction } from "@/lib/types";

const AGENTS = ["all", "luna", "mia", "anna", "jasper", "helios"];

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "success",
  negative: "destructive",
  neutral: "secondary",
  mixed: "warning",
};

export default function ActivityPage() {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [agent, setAgent] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const PAGE_SIZE = 25;

  const loadInteractions = useCallback(
    async (append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const res = await getInteractions({
          agent: agent !== "all" ? agent : undefined,
          limit: PAGE_SIZE,
        });
        const data = res.data || [];
        if (append) {
          setInteractions((prev) => [...prev, ...data]);
        } else {
          setInteractions(data);
        }
        setHasMore(data.length >= PAGE_SIZE);
      } catch {
        if (!append) setInteractions([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [agent]
  );

  useEffect(() => {
    loadInteractions();
  }, [loadInteractions]);

  function formatTimestamp(ts: string) {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activity</h1>
          <p className="text-muted-foreground">
            Recent interactions across all agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter agent" />
            </SelectTrigger>
            <SelectContent>
              {AGENTS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a === "all"
                    ? "All Agents"
                    : a.charAt(0).toUpperCase() + a.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => loadInteractions()}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-16 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : interactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium">No activity yet</p>
            <p className="text-sm text-muted-foreground">
              Interactions will appear here as agents log them
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {interactions.map((interaction) => (
              <Card key={interaction.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Direction icon */}
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        interaction.direction === "inbound"
                          ? "bg-blue-100 text-blue-600"
                          : "bg-emerald-100 text-emerald-600"
                      }`}
                    >
                      {interaction.direction === "inbound" ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {interaction.agent && (
                          <span className="inline-flex h-5 items-center rounded bg-primary/10 px-1.5 text-xs font-semibold text-primary capitalize">
                            {interaction.agent}
                          </span>
                        )}
                        <span className="text-sm font-medium">
                          {interaction.type}
                        </span>
                        {interaction.subject && (
                          <span className="text-sm text-muted-foreground truncate">
                            — {interaction.subject}
                          </span>
                        )}
                      </div>

                      {interaction.summary && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {interaction.summary}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {interaction.sentiment && (
                          <Badge
                            variant={
                              (SENTIMENT_COLORS[interaction.sentiment] as
                                | "success"
                                | "destructive"
                                | "secondary"
                                | "warning") || "secondary"
                            }
                          >
                            {interaction.sentiment}
                          </Badge>
                        )}
                        {interaction.intent && (
                          <Badge variant="outline">{interaction.intent}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(interaction.created_at)}
                        </span>
                      </div>

                      {interaction.key_points &&
                        interaction.key_points.length > 0 && (
                          <div className="mt-2">
                            <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-0.5">
                              {interaction.key_points.map((point, i) => (
                                <li key={i}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>

                    {/* Direction badge */}
                    <Badge variant="outline" className="shrink-0">
                      {interaction.direction}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => loadInteractions(true)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="mr-2 h-4 w-4" />
                )}
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
