import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { subscribeToTicket, unsubscribeFromTicket } from "@/lib/support-tickets";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const { id } = await context.params;
  await subscribeToTicket(id, authResult.userId!);
  return NextResponse.json({ subscribed: true });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const { id } = await context.params;
  await unsubscribeFromTicket(id, authResult.userId!);
  return NextResponse.json({ subscribed: false });
}
