import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { CreateTicketReplyInput } from "@/lib/schemas/support-tickets";
import { getTicket, listReplies, createReply } from "@/lib/support-tickets";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const { id } = await context.params;
  const ticket = await getTicket(id);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const replies = await listReplies(id);
  return NextResponse.json(replies);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const { id } = await context.params;
  const ticket = await getTicket(id);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const body = await request.json();
  const parsed = validateBody(CreateTicketReplyInput, body);
  if (!parsed.success) return parsed.error;

  const isAdmin = authResult.role === "admin";
  const reply = await createReply(id, authResult.userId!, parsed.data.body, isAdmin);

  return NextResponse.json(reply, { status: 201 });
}
