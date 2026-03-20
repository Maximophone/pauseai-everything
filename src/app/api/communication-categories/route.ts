import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { listCategories, createCategory } from "@/lib/communication-categories";
import { validateBody } from "@/lib/api-validate";
import { CreateCategoryInput } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const categories = await listCategories();
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const body = await request.json();
  const parsed = validateBody(CreateCategoryInput, body);
  if (!parsed.success) return parsed.error;

  const category = await createCategory({
    name: parsed.data.name,
    label: parsed.data.label,
    description: parsed.data.description ?? undefined,
    sortOrder: parsed.data.sortOrder,
  });

  return NextResponse.json(category, { status: 201 });
}
