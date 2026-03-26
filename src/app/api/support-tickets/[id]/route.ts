import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { UpdateTicketInput } from "@/lib/schemas/support-tickets";
import {
  getTicket,
  updateTicket,
  deleteTicket,
  listReplies,
  hasUserVoted,
  isSubscribed,
} from "@/lib/support-tickets";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const { id } = await context.params;
  const ticket = await getTicket(id);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const [replies, voted, subscribed] = await Promise.all([
    listReplies(id),
    hasUserVoted(id, authResult.userId!),
    isSubscribed(id, authResult.userId!),
  ]);

  return NextResponse.json({
    ticket: { ...ticket, hasVoted: voted },
    replies,
    isSubscribed: subscribed,
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const { id } = await context.params;
  const ticket = await getTicket(id);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const isAdmin = authResult.role === "admin";
  const isOwner = ticket.createdBy === authResult.userId;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json();
  const parsed = validateBody(UpdateTicketInput, body);
  if (!parsed.success) return parsed.error;

  // Non-admins can only update title/description on open tickets
  if (!isAdmin) {
    if (ticket.status !== "open") {
      return NextResponse.json(
        { error: "Can only edit open tickets." },
        { status: 403 }
      );
    }
    const { status, priority, type, ...allowed } = parsed.data;
    if (status || priority || type) {
      return NextResponse.json(
        { error: "Only admins can change status, priority, or type." },
        { status: 403 }
      );
    }
    const updated = await updateTicket(id, allowed);
    return NextResponse.json(updated);
  }

  const updated = await updateTicket(id, parsed.data, authResult.userId!);
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  if (authResult.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const ticket = await getTicket(id);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  await deleteTicket(id);
  return NextResponse.json({ success: true });
}
