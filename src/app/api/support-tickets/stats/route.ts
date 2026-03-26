import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { getTicketStats } from "@/lib/support-tickets";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const stats = await getTicketStats();
  return NextResponse.json(stats);
}
