import { NextRequest, NextResponse } from "next/server";
import { deleteInteraction } from "@/lib/interactions";
import { checkAuth, requireMember } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/interactions/:id
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const authError = requireMember(authResult);
  if (authError) return authError;
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
