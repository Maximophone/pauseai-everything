import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { CreateTicketReplyInput } from "@/lib/schemas/support-tickets";
import { getActiveWorkspaceId } from "@/lib/workspace-context";
import { getEffectiveRole } from "@/lib/workspaces";
import { getTicket, listReplies, createReply } from "@/lib/support-tickets";

type RouteContext = { params: Promise<{ id: string }> };

async function authorizeTicketAccess(
  request: NextRequest,
  context: RouteContext
) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return { error: authResult.error! };

  const workspaceId = await getActiveWorkspaceId(request);
  const { id } = await context.params;

  const ticket = await getTicket(id, workspaceId);
  if (!ticket) {
    return {
      error: NextResponse.json({ error: "Ticket not found." }, { status: 404 }),
    };
  }

  const effectiveRole = await getEffectiveRole(authResult.userId!, workspaceId);
  const isAdmin = effectiveRole === "admin";

  if (!isAdmin && ticket.createdBy !== authResult.userId) {
    return {
      error: NextResponse.json({ error: "Not authorized." }, { status: 403 }),
    };
  }

  return { authResult, ticket, workspaceId, isAdmin, ticketId: id };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const result = await authorizeTicketAccess(request, context);
  if ("error" in result && !("ticketId" in result)) return result.error;

  const replies = await listReplies(result.ticketId!);
  return NextResponse.json(replies);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const result = await authorizeTicketAccess(request, context);
  if ("error" in result && !("ticketId" in result)) return result.error;

  const body = await request.json();
  const parsed = validateBody(CreateTicketReplyInput, body);
  if (!parsed.success) return parsed.error;

  const reply = await createReply(
    result.ticketId!,
    result.authResult!.userId!,
    parsed.data.body,
    result.isAdmin!
  );

  return NextResponse.json(reply, { status: 201 });
}
