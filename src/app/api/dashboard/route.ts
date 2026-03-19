import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { getDashboardStats } from "@/lib/dashboard";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const stats = await getDashboardStats();
  return NextResponse.json(stats);
}
