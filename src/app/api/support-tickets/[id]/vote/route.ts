import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { toggleUpvote } from "@/lib/support-tickets";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const { id } = await context.params;
  const result = await toggleUpvote(id, authResult.userId!);
  return NextResponse.json(result);
}
