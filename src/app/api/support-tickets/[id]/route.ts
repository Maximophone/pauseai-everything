import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { UpdateTicketInput } from "@/lib/schemas/support-tickets";
import { getActiveWorkspaceId } from "@/lib/workspace-context";
import { getEffectiveRole } from "@/lib/workspaces";
import { getTicket, updateTicket, deleteTicket, listReplies } from "@/lib/support-tickets";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const workspaceId = await getActiveWorkspaceId(request);
  const { id } = await context.params;

  const ticket = await getTicket(id, workspaceId);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  // Non-admin users can only see their own tickets
  const effectiveRole = await getEffectiveRole(authResult.userId!, workspaceId);
  if (effectiveRole !== "admin" && ticket.createdBy !== authResult.userId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const replies = await listReplies(id);
  return NextResponse.json({ ticket, replies });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const workspaceId = await getActiveWorkspaceId(request);
  const { id } = await context.params;

  const ticket = await getTicket(id, workspaceId);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const effectiveRole = await getEffectiveRole(authResult.userId!, workspaceId);
  const isAdmin = effectiveRole === "admin";
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
    const updated = await updateTicket(id, allowed, workspaceId);
    return NextResponse.json(updated);
  }

  const updated = await updateTicket(id, parsed.data, workspaceId);
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const workspaceId = await getActiveWorkspaceId(request);
  const { id } = await context.params;

  const ticket = await getTicket(id, workspaceId);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const effectiveRole = await getEffectiveRole(authResult.userId!, workspaceId);
  if (effectiveRole !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  await deleteTicket(id, workspaceId);
  return NextResponse.json({ success: true });
}
