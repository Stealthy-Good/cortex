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
import { Search, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { getContacts, getContext } from "@/lib/api";
import type { Contact, ContactContext } from "@/lib/types";

const STAGES = [
  "all",
  "prospect",
  "qualified",
  "opportunity",
  "customer",
  "churning",
  "lost",
  "recovered",
] as const;

const STAGE_COLORS: Record<string, string> = {
  prospect: "secondary",
  qualified: "default",
  opportunity: "default",
  customer: "success",
  churning: "warning",
  lost: "destructive",
  recovered: "success",
};

const PAGE_SIZE = 20;

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [context, setContext] = useState<ContactContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getContacts({
        search: search || undefined,
        stage: stage !== "all" ? stage : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setContacts(res.data || []);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [search, stage, page]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  async function loadContext(contactId: string) {
    setContextLoading(true);
    try {
      const res = await getContext(contactId);
      setContext(res.data || null);
    } catch {
      setContext(null);
    } finally {
      setContextLoading(false);
    }
  }

  function selectContact(contact: Contact) {
    setSelectedContact(contact);
    loadContext(contact.id);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Contacts</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Select
          value={stage}
          onValueChange={(v) => {
            setStage(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by stage" />
          </SelectTrigger>
          <SelectContent>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All Stages" : s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">Company</th>
                      <th className="px-4 py-3 text-left font-medium">Stage</th>
                      <th className="px-4 py-3 text-left font-medium">Agent</th>
                      <th className="px-4 py-3 text-left font-medium">Last Touch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="h-4 w-full animate-pulse rounded bg-muted" />
                          </td>
                        </tr>
                      ))
                    ) : contacts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                          No contacts found
                        </td>
                      </tr>
                    ) : (
                      contacts.map((contact) => (
                        <tr
                          key={contact.id}
                          onClick={() => selectContact(contact)}
                          className={`cursor-pointer border-b transition-colors hover:bg-muted/50 ${
                            selectedContact?.id === contact.id ? "bg-muted" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-xs text-muted-foreground">{contact.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {contact.company_name || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={STAGE_COLORS[contact.stage] as "default" | "secondary" | "destructive" | "outline" | "success" | "warning" || "secondary"}>
                              {contact.stage}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 capitalize text-muted-foreground">
                            {contact.owner_agent || "-"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {contact.last_touch_at
                              ? new Date(contact.last_touch_at).toLocaleDateString()
                              : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Page {page + 1}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={contacts.length < PAGE_SIZE}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact Detail Panel */}
        <div>
          {selectedContact ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedContact.name}</CardTitle>
                <CardDescription>{selectedContact.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Company</p>
                    <p className="font-medium">{selectedContact.company_name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stage</p>
                    <Badge variant={STAGE_COLORS[selectedContact.stage] as "default" | "secondary" | "destructive" | "outline" | "success" | "warning" || "secondary"}>
                      {selectedContact.stage}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Owner</p>
                    <p className="font-medium capitalize">{selectedContact.owner_agent || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Source</p>
                    <p className="font-medium">{selectedContact.source || "-"}</p>
                  </div>
                </div>

                {selectedContact.tags && selectedContact.tags.length > 0 && (
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedContact.tags.map((tag) => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Context */}
                <div className="border-t pt-4">
                  <h4 className="mb-2 text-sm font-semibold flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    AI Context
                  </h4>
                  {contextLoading ? (
                    <div className="space-y-2">
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    </div>
                  ) : context ? (
                    <div className="space-y-3 text-sm">
                      <p>{context.summary}</p>
                      {context.current_status && (
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <p>{context.current_status}</p>
                        </div>
                      )}
                      {context.recommended_tone && (
                        <div>
                          <p className="text-muted-foreground">Recommended Tone</p>
                          <p>{context.recommended_tone}</p>
                        </div>
                      )}
                      {context.churn_risk_score != null && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-muted-foreground">Churn Risk</p>
                            <p className="font-medium">{(context.churn_risk_score * 100).toFixed(0)}%</p>
                          </div>
                          {context.upsell_potential_score != null && (
                            <div>
                              <p className="text-muted-foreground">Upsell Potential</p>
                              <p className="font-medium">{(context.upsell_potential_score * 100).toFixed(0)}%</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No context generated yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex h-48 items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Select a contact to view details
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
