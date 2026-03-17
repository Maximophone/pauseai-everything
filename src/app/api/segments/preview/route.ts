import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { previewSegment } from "@/lib/segments";

export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const body = await request.json();
  const { filter } = body;

  if (!filter || !filter.conditions || !["all", "any"].includes(filter.match)) {
    return NextResponse.json(
      { error: "Valid filter with match and conditions required." },
      { status: 400 }
    );
  }

  const result = await previewSegment(filter);
  return NextResponse.json(result);
}
