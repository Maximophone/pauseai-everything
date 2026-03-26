"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { StatusBadge, TypeBadge, PriorityBadge } from "./status-badge";
import { Button } from "@/components/ui/button";
import { PlusIcon, ThumbsUpIcon, BellIcon, BellOffIcon } from "lucide-react";

type Ticket = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  upvoteCount: number;
  hasVoted?: boolean;
  creatorName: string | null;
  creatorEmail: string;
  createdAt: string;
};

type TicketStats = Record<string, number>;

export function TicketList() {
  const role = useUserRole();
  const isAdmin = role === "admin";

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [subscribedToAll, setSubscribedToAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"newest" | "most_voted">("newest");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    params.set("sortBy", sortBy);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    try {
      const res = await fetch(`/api/support-tickets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets);
        setTotal(data.total);
        if (data.stats) setStats(data.stats);
        if (data.subscribedToAll !== undefined) setSubscribedToAll(data.subscribedToAll);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, sortBy, page]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  async function handleGlobalSubscribeToggle() {
    const newValue = !subscribedToAll;
    const res = await fetch("/api/support-tickets/subscribe-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscribed: newValue }),
    });
    if (res.ok) {
      const data = await res.json();
      setSubscribedToAll(data.subscribedToAll);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          {(["open", "in_progress", "resolved", "closed"] as const).map((s) => (
            <div key={s} className="rounded-lg border p-4">
              <div className="text-2xl font-bold">{stats[s] ?? 0}</div>
              <div className="text-sm text-muted-foreground capitalize">{s.replace("_", " ")}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters + sort + actions */}
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
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as "newest" | "most_voted"); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="most_voted">Most Voted</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={subscribedToAll ? "default" : "outline"}
            size="sm"
            onClick={handleGlobalSubscribeToggle}
            title={subscribedToAll ? "You receive notifications for all tickets" : "Subscribe to all ticket notifications"}
          >
            {subscribedToAll ? (
              <>
                <BellOffIcon className="h-4 w-4 mr-1" />
                Unsubscribe All
              </>
            ) : (
              <>
                <BellIcon className="h-4 w-4 mr-1" />
                Subscribe All
              </>
            )}
          </Button>
          <Link href="/dashboard/support/new">
            <Button size="sm">
              <PlusIcon className="h-4 w-4 mr-1" />
              New Ticket
            </Button>
          </Link>
        </div>
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
      ) : tickets.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
          No tickets found. Submit a ticket to report an issue or request a feature.
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
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Upvote count */}
                  <div className="flex flex-col items-center shrink-0 w-10">
                    <ThumbsUpIcon
                      className={`h-4 w-4 ${ticket.hasVoted ? "text-primary fill-primary" : "text-muted-foreground"}`}
                    />
                    <span className="text-xs font-medium">{ticket.upvoteCount}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{ticket.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      <span>{ticket.creatorName || ticket.creatorEmail}</span>
                      <span> &middot; </span>
                      <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
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
