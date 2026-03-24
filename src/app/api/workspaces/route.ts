import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin, requireAuth } from "@/lib/api-auth";
import {
  listWorkspaces,
  createWorkspace,
  getUserWorkspaces,
} from "@/lib/workspaces";

// GET /api/workspaces — list workspaces the user belongs to (or all for admin)
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;

  // Admin sees all workspaces; others see only their own
  if (authResult.role === "admin") {
    const all = await listWorkspaces();
    return NextResponse.json(all);
  }

  if (!authResult.userId) {
    return NextResponse.json([]);
  }

  const userWs = await getUserWorkspaces(authResult.userId);
  return NextResponse.json(userWs);
}

// POST /api/workspaces — create a new workspace (global admin only)
export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const body = await request.json();
  const { name, slug, type, defaultLanguage } = body;

  if (!name || !slug || !type) {
    return NextResponse.json(
      { error: "name, slug, and type are required" },
      { status: 400 }
    );
  }

  if (!["global", "chapter"].includes(type)) {
    return NextResponse.json(
      { error: "type must be 'global' or 'chapter'" },
      { status: 400 }
    );
  }

  try {
    const workspace = await createWorkspace({
      name,
      slug,
      type,
      defaultLanguage,
    });
    return NextResponse.json(workspace, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("unique")) {
      return NextResponse.json(
        { error: "A workspace with that slug already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
