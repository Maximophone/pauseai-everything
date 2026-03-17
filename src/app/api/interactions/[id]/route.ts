import { NextRequest, NextResponse } from "next/server";
import { deleteInteraction } from "@/lib/interactions";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/interactions/:id
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const deleted = await deleteInteraction(id);

  if (!deleted) {
    return NextResponse.json(
      { error: "Interaction not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
