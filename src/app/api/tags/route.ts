import { NextRequest, NextResponse } from "next/server";
import { listTags, createTag } from "@/lib/tags";

// GET /api/tags
export async function GET() {
  const allTags = await listTags();
  return NextResponse.json(allTags);
}

// POST /api/tags
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, color } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  try {
    const tag = await createTag(name, color);
    return NextResponse.json(tag, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: `Tag "${name}" already exists.` },
        { status: 409 }
      );
    }
    throw err;
  }
}
