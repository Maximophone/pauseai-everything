"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceFetch } from "@/components/workspace-provider";
import { useEffectiveRole } from "@/lib/hooks/use-user-role";
import { StatusBadge, TypeBadge, PriorityBadge } from "./status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon } from "lucide-react";

type Ticket = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  createdBy: string;
  creatorName: string | null;
  creatorEmail: string;
  createdAt: string;
  updatedAt: string;
};

type Reply = {
  id: string;
  body: string;
  isAdminReply: boolean;
  userName: string | null;
  userEmail: string;
  createdAt: string;
};

export function TicketDetail({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const workspaceFetch = useWorkspaceFetch();
  const effectiveRole = useEffectiveRole();
  const isAdmin = effectiveRole === "admin";

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchTicket = useCallback(async () => {
    try {
      const res = await workspaceFetch(`/api/support-tickets/${ticketId}`);
      if (!res.ok) {
        router.push("/dashboard/support");
        return;
      }
      const data = await res.json();
      setTicket(data.ticket);
      setReplies(data.replies);
    } finally {
      setLoading(false);
    }
  }, [workspaceFetch, ticketId, router]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  async function handleStatusChange(status: string) {
    const res = await workspaceFetch(`/api/support-tickets/${ticketId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTicket((t) => t ? { ...t, ...updated } : t);
    }
  }

  async function handlePriorityChange(priority: string) {
    const res = await workspaceFetch(`/api/support-tickets/${ticketId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTicket((t) => t ? { ...t, ...updated } : t);
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await workspaceFetch(`/api/support-tickets/${ticketId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyText }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to post reply.");
        return;
      }

      setReplyText("");
      fetchTicket();
    } catch {
      setError("Failed to post reply.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>;
  }

  if (!ticket) return null;

  const isClosed = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back link */}
      <button
        onClick={() => router.push("/dashboard/support")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to tickets
      </button>

      {/* Ticket header */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{ticket.title}</h2>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <span>by {ticket.creatorName || ticket.creatorEmail}</span>
            <span>&middot;</span>
            <span>{new Date(ticket.createdAt).toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge type={ticket.type} />
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>

        {/* Admin controls */}
        {isAdmin && (
          <div className="flex gap-4 p-3 rounded-lg border bg-muted/30">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="block h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <select
                value={ticket.priority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                className="block h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
        )}

        {/* Description */}
        <div className="rounded-lg border p-4 whitespace-pre-wrap text-sm">
          {ticket.description}
        </div>
      </div>

      {/* Reply thread */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          Replies {replies.length > 0 && `(${replies.length})`}
        </h3>

        {replies.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
            No replies yet.
          </div>
        ) : (
          <div className="space-y-3">
            {replies.map((reply) => (
              <div
                key={reply.id}
                className={cn(
                  "rounded-lg border p-4",
                  reply.isAdminReply && "bg-accent/30 border-accent"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">
                    {reply.userName || reply.userEmail}
                  </span>
                  {reply.isAdminReply && (
                    <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium">
                      Staff
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(reply.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm whitespace-pre-wrap">{reply.body}</div>
              </div>
            ))}
          </div>
        )}

        {/* Reply form */}
        {!isClosed && (
          <form onSubmit={handleReply} className="space-y-3">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {error}
              </div>
            )}
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              rows={3}
              maxLength={5000}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <Button type="submit" disabled={submitting || !replyText.trim()}>
              {submitting ? "Posting..." : "Post Reply"}
            </Button>
          </form>
        )}

        {isClosed && (
          <div className="text-sm text-muted-foreground py-3 text-center border rounded-lg">
            This ticket is {ticket.status}. No further replies can be added.
          </div>
        )}
      </div>
    </div>
  );
}
