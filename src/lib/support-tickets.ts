import { db } from "@/db";
import {
  supportTickets,
  ticketReplies,
  ticketUpvotes,
  ticketSubscriptions,
  type SupportTicket,
  type TicketReply,
} from "@/db/schema/support-tickets";
import { users } from "@/db/schema/users";
import { eq, and, desc, sql, count, or } from "drizzle-orm";
import { addJob } from "@/lib/worker-client";

// ─── Types ───────────────────────────────────────────────

export type SupportTicketWithUser = SupportTicket & {
  creatorName: string | null;
  creatorEmail: string;
  hasVoted?: boolean;
};

export type TicketReplyWithUser = TicketReply & {
  userName: string | null;
  userEmail: string;
};

// ─── Tickets ─────────────────────────────────────────────

export async function listTickets(options: {
  status?: string;
  type?: string;
  sortBy?: "newest" | "most_voted";
  currentUserId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ tickets: SupportTicketWithUser[]; total: number }> {
  const { status, type, sortBy = "newest", currentUserId, page = 1, pageSize = 20 } = options;

  const conditions = [];
  if (status) conditions.push(eq(supportTickets.status, status as SupportTicket["status"]));
  if (type) conditions.push(eq(supportTickets.type, type as SupportTicket["type"]));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(supportTickets)
    .where(where);

  const orderBy = sortBy === "most_voted"
    ? [desc(supportTickets.upvoteCount), desc(supportTickets.createdAt)]
    : [desc(supportTickets.createdAt)];

  const tickets = await db
    .select({
      id: supportTickets.id,
      title: supportTickets.title,
      description: supportTickets.description,
      type: supportTickets.type,
      status: supportTickets.status,
      priority: supportTickets.priority,
      upvoteCount: supportTickets.upvoteCount,
      createdBy: supportTickets.createdBy,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      creatorName: users.name,
      creatorEmail: users.email,
      ...(currentUserId
        ? {
            hasVoted: sql<boolean>`EXISTS (
              SELECT 1 FROM ticket_upvotes
              WHERE ticket_upvotes.ticket_id = ${supportTickets.id}
              AND ticket_upvotes.user_id = ${currentUserId}
            )`.as("has_voted"),
          }
        : {}),
    })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.createdBy, users.id))
    .where(where)
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    tickets: tickets as SupportTicketWithUser[],
    total,
  };
}

export async function getTicket(id: string): Promise<SupportTicketWithUser | null> {
  const [ticket] = await db
    .select({
      id: supportTickets.id,
      title: supportTickets.title,
      description: supportTickets.description,
      type: supportTickets.type,
      status: supportTickets.status,
      priority: supportTickets.priority,
      upvoteCount: supportTickets.upvoteCount,
      createdBy: supportTickets.createdBy,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      creatorName: users.name,
      creatorEmail: users.email,
    })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.createdBy, users.id))
    .where(eq(supportTickets.id, id));

  return (ticket as SupportTicketWithUser) ?? null;
}

export async function createTicket(
  data: {
    title: string;
    description: string;
    type: string;
    priority?: string;
  },
  userId: string
): Promise<SupportTicket> {
  const [ticket] = await db
    .insert(supportTickets)
    .values({
      title: data.title,
      description: data.description,
      type: data.type as SupportTicket["type"],
      priority: (data.priority as SupportTicket["priority"]) ?? "medium",
      createdBy: userId,
    })
    .returning();

  // Auto-subscribe creator
  await db
    .insert(ticketSubscriptions)
    .values({ ticketId: ticket.id, userId })
    .onConflictDoNothing();

  return ticket;
}

export async function updateTicket(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    type: string;
    status: string;
    priority: string;
  }>,
  actorUserId?: string
): Promise<SupportTicket | null> {
  // Get current ticket to detect status change
  let oldStatus: string | undefined;
  if (data.status && actorUserId) {
    const [current] = await db
      .select({ status: supportTickets.status })
      .from(supportTickets)
      .where(eq(supportTickets.id, id));
    if (current) oldStatus = current.status;
  }

  const [updated] = await db
    .update(supportTickets)
    .set({ ...data, updatedAt: new Date() } as Partial<SupportTicket>)
    .where(eq(supportTickets.id, id))
    .returning();

  if (!updated) return null;

  // Enqueue notification on status change
  if (data.status && oldStatus && data.status !== oldStatus && actorUserId) {
    try {
      await addJob("send_ticket_notification", {
        ticketId: id,
        event: "status_change",
        actorUserId,
        newStatus: data.status,
        oldStatus,
      });
    } catch {
      // Don't fail the update if notification enqueueing fails
    }
  }

  return updated;
}

export async function deleteTicket(id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(supportTickets)
    .where(eq(supportTickets.id, id))
    .returning({ id: supportTickets.id });
  return !!deleted;
}

// ─── Replies ─────────────────────────────────────────────

export async function listReplies(ticketId: string): Promise<TicketReplyWithUser[]> {
  const replies = await db
    .select({
      id: ticketReplies.id,
      ticketId: ticketReplies.ticketId,
      userId: ticketReplies.userId,
      body: ticketReplies.body,
      isAdminReply: ticketReplies.isAdminReply,
      createdAt: ticketReplies.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(ticketReplies)
    .leftJoin(users, eq(ticketReplies.userId, users.id))
    .where(eq(ticketReplies.ticketId, ticketId))
    .orderBy(ticketReplies.createdAt);

  return replies as TicketReplyWithUser[];
}

export async function createReply(
  ticketId: string,
  userId: string,
  body: string,
  isAdminReply: boolean
): Promise<TicketReply> {
  const [reply] = await db
    .insert(ticketReplies)
    .values({ ticketId, userId, body, isAdminReply })
    .returning();

  // Auto-subscribe replier
  await db
    .insert(ticketSubscriptions)
    .values({ ticketId, userId })
    .onConflictDoNothing();

  // Enqueue notification
  try {
    await addJob("send_ticket_notification", {
      ticketId,
      event: "new_reply",
      actorUserId: userId,
      replyId: reply.id,
    });
  } catch {
    // Don't fail the reply if notification enqueueing fails
  }

  return reply;
}

// ─── Voting ─────────────────────────────────────────────

export async function toggleUpvote(
  ticketId: string,
  userId: string
): Promise<{ upvoted: boolean; upvoteCount: number }> {
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(ticketUpvotes)
      .where(and(eq(ticketUpvotes.ticketId, ticketId), eq(ticketUpvotes.userId, userId)));

    if (existing) {
      await tx
        .delete(ticketUpvotes)
        .where(and(eq(ticketUpvotes.ticketId, ticketId), eq(ticketUpvotes.userId, userId)));
      const [updated] = await tx
        .update(supportTickets)
        .set({ upvoteCount: sql`${supportTickets.upvoteCount} - 1` })
        .where(eq(supportTickets.id, ticketId))
        .returning({ upvoteCount: supportTickets.upvoteCount });
      return { upvoted: false, upvoteCount: updated.upvoteCount };
    } else {
      await tx.insert(ticketUpvotes).values({ ticketId, userId });
      const [updated] = await tx
        .update(supportTickets)
        .set({ upvoteCount: sql`${supportTickets.upvoteCount} + 1` })
        .where(eq(supportTickets.id, ticketId))
        .returning({ upvoteCount: supportTickets.upvoteCount });
      return { upvoted: true, upvoteCount: updated.upvoteCount };
    }
  });
}

export async function hasUserVoted(ticketId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ ticketId: ticketUpvotes.ticketId })
    .from(ticketUpvotes)
    .where(and(eq(ticketUpvotes.ticketId, ticketId), eq(ticketUpvotes.userId, userId)));
  return !!row;
}

// ─── Subscriptions ──────────────────────────────────────

export async function subscribeToTicket(ticketId: string, userId: string): Promise<void> {
  await db
    .insert(ticketSubscriptions)
    .values({ ticketId, userId })
    .onConflictDoNothing();
}

export async function unsubscribeFromTicket(ticketId: string, userId: string): Promise<void> {
  await db
    .delete(ticketSubscriptions)
    .where(and(eq(ticketSubscriptions.ticketId, ticketId), eq(ticketSubscriptions.userId, userId)));
}

export async function isSubscribed(ticketId: string, userId: string): Promise<boolean> {
  // Check explicit subscription
  const [sub] = await db
    .select({ id: ticketSubscriptions.id })
    .from(ticketSubscriptions)
    .where(and(eq(ticketSubscriptions.ticketId, ticketId), eq(ticketSubscriptions.userId, userId)));
  if (sub) return true;

  // Check global subscribe flag
  const [user] = await db
    .select({ flag: users.subscribeToAllTickets })
    .from(users)
    .where(eq(users.id, userId));
  return user?.flag ?? false;
}

export async function getTicketSubscribers(
  ticketId: string,
  excludeUserId?: string
): Promise<{ userId: string; email: string; name: string | null }[]> {
  // Get explicit subscribers
  const explicit = await db
    .select({
      userId: ticketSubscriptions.userId,
      email: users.email,
      name: users.name,
    })
    .from(ticketSubscriptions)
    .innerJoin(users, eq(ticketSubscriptions.userId, users.id))
    .where(eq(ticketSubscriptions.ticketId, ticketId));

  // Get users with subscribeToAllTickets flag
  const global = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.subscribeToAllTickets, true));

  // Deduplicate and exclude actor
  const seen = new Set<string>();
  const result: { userId: string; email: string; name: string | null }[] = [];

  for (const sub of [...explicit, ...global]) {
    if (seen.has(sub.userId)) continue;
    if (excludeUserId && sub.userId === excludeUserId) continue;
    seen.add(sub.userId);
    result.push(sub as { userId: string; email: string; name: string | null });
  }

  return result;
}

export async function getGlobalSubscription(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ flag: users.subscribeToAllTickets })
    .from(users)
    .where(eq(users.id, userId));
  return user?.flag ?? false;
}

export async function setGlobalSubscription(userId: string, subscribed: boolean): Promise<void> {
  await db
    .update(users)
    .set({ subscribeToAllTickets: subscribed })
    .where(eq(users.id, userId));
}

// ─── Stats ───────────────────────────────────────────────

export async function getTicketStats() {
  const rows = await db
    .select({
      status: supportTickets.status,
      count: count(),
    })
    .from(supportTickets)
    .groupBy(supportTickets.status);

  const stats: Record<string, number> = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
  for (const row of rows) {
    stats[row.status] = row.count;
  }
  return stats;
}
