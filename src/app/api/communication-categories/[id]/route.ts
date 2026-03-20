import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getCategory, updateCategory, deleteCategory } from "@/lib/communication-categories";
import { validateBody, stripNulls } from "@/lib/api-validate";
import { UpdateCategoryInput } from "@/lib/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const { id } = await context.params;
  const category = await getCategory(id);
  if (!category) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  return NextResponse.json(category);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = validateBody(UpdateCategoryInput, body);
  if (!parsed.success) return parsed.error;

  const updated = await updateCategory(id, stripNulls(parsed.data));
  if (!updated) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const deleted = await deleteCategory(id);
  if (!deleted) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
