import { NextRequest, NextResponse } from "next/server";
import { listTags, createTag } from "@/lib/tags";
import { validateBody } from "@/lib/api-validate";
import { CreateTagInput } from "@/lib/schemas";

// GET /api/tags
export async function GET() {
  const allTags = await listTags();
  return NextResponse.json(allTags);
}

// POST /api/tags
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = validateBody(CreateTagInput, body);
  if (!parsed.success) return parsed.error;

  try {
    const tag = await createTag(parsed.data.name, parsed.data.color ?? undefined);
    return NextResponse.json(tag, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: `Tag "${parsed.data.name}" already exists.` },
        { status: 409 }
      );
    }
    throw err;
  }
}
