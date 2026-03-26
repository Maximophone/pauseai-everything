"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useWorkspaceFetch, useWorkspace } from "@/components/workspace-provider";
import { useEffectiveRole } from "@/lib/hooks/use-user-role";
import { StatusBadge, TypeBadge, PriorityBadge } from "./status-badge";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";

type Ticket = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  creatorName: string | null;
  creatorEmail: string;
  createdAt: string;
};

type TicketStats = Record<string, number>;

export function TicketList() {
  const workspaceFetch = useWorkspaceFetch();
  const { activeWorkspace } = useWorkspace();
  const effectiveRole = useEffectiveRole();
  const isAdmin = effectiveRole === "admin";

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    try {
      const res = await workspaceFetch(`/api/support-tickets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets);
        setTotal(data.total);
        if (data.stats) setStats(data.stats);
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceFetch, statusFilter, typeFilter, page]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets, activeWorkspace?.id]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Admin stats */}
      {isAdmin && stats && (
        <div className="grid grid-cols-4 gap-4">
          {(["open", "in_progress", "resolved", "closed"] as const).map((s) => (
            <div key={s} className="rounded-lg border p-4">
              <div className="text-2xl font-bold">{stats[s] ?? 0}</div>
              <div className="text-sm text-muted-foreground capitalize">{s.replace("_", " ")}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters + actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All types</option>
            <option value="bug">Bug</option>
            <option value="feature">Feature</option>
          </select>
        </div>
        <Link href="/dashboard/support/new">
          <Button size="sm">
            <PlusIcon className="h-4 w-4 mr-1" />
            New Ticket
          </Button>
        </Link>
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
      ) : tickets.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
          No tickets found. {!isAdmin && "Submit a ticket to report an issue or request a feature."}
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/dashboard/support/${ticket.id}`}
              className="block px-4 py-3 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{ticket.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {isAdmin && (
                      <span>{ticket.creatorName || ticket.creatorEmail} &middot; </span>
                    )}
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PriorityBadge priority={ticket.priority} />
                  <TypeBadge type={ticket.type} />
                  <StatusBadge status={ticket.status} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {total} ticket{total !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="flex items-center px-2 text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
