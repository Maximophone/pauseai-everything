import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { getGlobalSubscription, setGlobalSubscription } from "@/lib/support-tickets";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const subscribed = await getGlobalSubscription(authResult.userId!);
  return NextResponse.json({ subscribedToAll: subscribed });
}

export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const body = await request.json();
  const subscribed = !!body.subscribed;

  await setGlobalSubscription(authResult.userId!, subscribed);
  return NextResponse.json({ subscribedToAll: subscribed });
}
