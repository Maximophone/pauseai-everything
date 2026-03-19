import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { listSegments, createSegment } from "@/lib/segments";
import { validateBody } from "@/lib/api-validate";
import { CreateSegmentInput } from "@/lib/schemas";

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
  const parsed = validateBody(CreateSegmentInput, body);
  if (!parsed.success) return parsed.error;

  const segment = await createSegment({
    name: parsed.data.name,
    description: parsed.data.description ?? undefined,
    filter: parsed.data.filter,
    createdBy: authResult.userId,
  });

  return NextResponse.json(segment, { status: 201 });
}
