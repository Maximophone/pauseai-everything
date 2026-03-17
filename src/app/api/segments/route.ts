import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { listSegments, createSegment } from "@/lib/segments";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const segments = await listSegments();
  return NextResponse.json(segments);
}

export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const body = await request.json();
  const { name, description, filter } = body;

  if (!name || !filter || !filter.conditions) {
    return NextResponse.json(
      { error: "name and filter (with conditions) are required." },
      { status: 400 }
    );
  }

  if (!["all", "any"].includes(filter.match)) {
    return NextResponse.json(
      { error: 'filter.match must be "all" or "any".' },
      { status: 400 }
    );
  }

  const segment = await createSegment({
    name,
    description,
    filter,
    createdBy: authResult.userId,
  });

  return NextResponse.json(segment, { status: 201 });
}
