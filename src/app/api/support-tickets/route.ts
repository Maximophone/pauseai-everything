import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { CreateTicketInput } from "@/lib/schemas/support-tickets";
import { getActiveWorkspaceId } from "@/lib/workspace-context";
import { getEffectiveRole } from "@/lib/workspaces";
import { listTickets, createTicket, getTicketStats } from "@/lib/support-tickets";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const workspaceId = await getActiveWorkspaceId(request);
  const effectiveRole = await getEffectiveRole(authResult.userId!, workspaceId);
  const isAdmin = effectiveRole === "admin";

  const url = request.nextUrl;
  const status = url.searchParams.get("status") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20", 10);

  const result = await listTickets({
    workspaceId,
    userId: isAdmin ? undefined : authResult.userId!,
    status,
    type,
    page,
    pageSize,
  });

  const stats = isAdmin ? await getTicketStats(workspaceId) : undefined;

  return NextResponse.json({ ...result, stats });
}

export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const workspaceId = await getActiveWorkspaceId(request);

  const body = await request.json();
  const parsed = validateBody(CreateTicketInput, body);
  if (!parsed.success) return parsed.error;

  const ticket = await createTicket(parsed.data, workspaceId, authResult.userId!);
  return NextResponse.json(ticket, { status: 201 });
}
