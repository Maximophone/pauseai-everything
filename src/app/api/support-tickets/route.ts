import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { CreateTicketInput } from "@/lib/schemas/support-tickets";
import { listTickets, createTicket, getTicketStats, getGlobalSubscription } from "@/lib/support-tickets";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const url = request.nextUrl;
  const status = url.searchParams.get("status") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const sortBy = (url.searchParams.get("sortBy") as "newest" | "most_voted") ?? "newest";
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20", 10);

  const result = await listTickets({
    status,
    type,
    sortBy,
    currentUserId: authResult.userId!,
    page,
    pageSize,
  });

  const [stats, subscribedToAll] = await Promise.all([
    getTicketStats(),
    getGlobalSubscription(authResult.userId!),
  ]);

  return NextResponse.json({ ...result, stats, subscribedToAll });
}

export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const body = await request.json();
  const parsed = validateBody(CreateTicketInput, body);
  if (!parsed.success) return parsed.error;

  const ticket = await createTicket(parsed.data, authResult.userId!);
  return NextResponse.json(ticket, { status: 201 });
}
