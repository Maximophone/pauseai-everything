import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { CreateCategoryInput } from "@/lib/schemas";
import { getActiveWorkspaceId, requireWorkspaceMember } from "@/lib/workspace-context";
import { db } from "@/db";
import { communicationCategories } from "@/db/schema/communication-categories";
import { eq, asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const authError = await requireWorkspaceMember(authResult, workspaceId);
  if (authError) return authError;
  const categories = await db
    .select()
    .from(communicationCategories)
    .where(eq(communicationCategories.workspaceId, workspaceId))
    .orderBy(asc(communicationCategories.sortOrder));
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const workspaceId = await getActiveWorkspaceId(request);
  const body = await request.json();
  const parsed = validateBody(CreateCategoryInput, body);
  if (!parsed.success) return parsed.error;

  const [category] = await db
    .insert(communicationCategories)
    .values({
      name: parsed.data.name,
      label: parsed.data.label,
      description: parsed.data.description ?? undefined,
      sortOrder: parsed.data.sortOrder,
      workspaceId,
    })
    .returning();

  return NextResponse.json(category, { status: 201 });
}
