import { db } from "@/db";
import {
  supportTickets,
  ticketReplies,
  type SupportTicket,
  type TicketReply,
} from "@/db/schema/support-tickets";
import { users } from "@/db/schema/users";
import { eq, and, desc, sql, count } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────

export type SupportTicketWithUser = SupportTicket & {
  creatorName: string | null;
  creatorEmail: string;
};

export type TicketReplyWithUser = TicketReply & {
  userName: string | null;
  userEmail: string;
};

// ─── Tickets ─────────────────────────────────────────────

export async function listTickets(options: {
  workspaceId: string;
  userId?: string;
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ tickets: SupportTicketWithUser[]; total: number }> {
  const { workspaceId, userId, status, type, page = 1, pageSize = 20 } = options;

  const conditions = [eq(supportTickets.workspaceId, workspaceId)];
  if (userId) conditions.push(eq(supportTickets.createdBy, userId));
  if (status) conditions.push(eq(supportTickets.status, status as SupportTicket["status"]));
  if (type) conditions.push(eq(supportTickets.type, type as SupportTicket["type"]));

  const where = and(...conditions);

  const [{ total }] = await db
    .select({ total: count() })
    .from(supportTickets)
    .where(where);

  const tickets = await db
    .select({
      id: supportTickets.id,
      title: supportTickets.title,
      description: supportTickets.description,
      type: supportTickets.type,
      status: supportTickets.status,
      priority: supportTickets.priority,
      workspaceId: supportTickets.workspaceId,
      createdBy: supportTickets.createdBy,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      creatorName: users.name,
      creatorEmail: users.email,
    })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.createdBy, users.id))
    .where(where)
    .orderBy(desc(supportTickets.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    tickets: tickets as SupportTicketWithUser[],
    total,
  };
}

export async function getTicket(
  id: string,
  workspaceId: string
): Promise<SupportTicketWithUser | null> {
  const [ticket] = await db
    .select({
      id: supportTickets.id,
      title: supportTickets.title,
      description: supportTickets.description,
      type: supportTickets.type,
      status: supportTickets.status,
      priority: supportTickets.priority,
      workspaceId: supportTickets.workspaceId,
      createdBy: supportTickets.createdBy,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      creatorName: users.name,
      creatorEmail: users.email,
    })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.createdBy, users.id))
    .where(and(eq(supportTickets.id, id), eq(supportTickets.workspaceId, workspaceId)));

  return (ticket as SupportTicketWithUser) ?? null;
}

export async function createTicket(
  data: {
    title: string;
    description: string;
    type: string;
    priority?: string;
  },
  workspaceId: string,
  userId: string
): Promise<SupportTicket> {
  const [ticket] = await db
    .insert(supportTickets)
    .values({
      title: data.title,
      description: data.description,
      type: data.type as SupportTicket["type"],
      priority: (data.priority as SupportTicket["priority"]) ?? "medium",
      workspaceId,
      createdBy: userId,
    })
    .returning();
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
  workspaceId: string
): Promise<SupportTicket | null> {
  const [updated] = await db
    .update(supportTickets)
    .set({ ...data, updatedAt: new Date() } as Partial<SupportTicket>)
    .where(and(eq(supportTickets.id, id), eq(supportTickets.workspaceId, workspaceId)))
    .returning();
  return updated ?? null;
}

export async function deleteTicket(
  id: string,
  workspaceId: string
): Promise<boolean> {
  const [deleted] = await db
    .delete(supportTickets)
    .where(and(eq(supportTickets.id, id), eq(supportTickets.workspaceId, workspaceId)))
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
  return reply;
}

// ─── Stats ───────────────────────────────────────────────

export async function getTicketStats(workspaceId: string) {
  const rows = await db
    .select({
      status: supportTickets.status,
      count: count(),
    })
    .from(supportTickets)
    .where(eq(supportTickets.workspaceId, workspaceId))
    .groupBy(supportTickets.status);

  const stats: Record<string, number> = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
  for (const row of rows) {
    stats[row.status] = row.count;
  }
  return stats;
}
