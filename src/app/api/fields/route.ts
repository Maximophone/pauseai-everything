import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fieldDefinitions } from "@/db/schema/field-definitions";
import { asc } from "drizzle-orm";
import { validateBody } from "@/lib/api-validate";
import { CreateFieldInput } from "@/lib/schemas";
import { checkAuth, requireAuth, requireAdmin } from "@/lib/api-auth";
import { getActiveWorkspaceId } from "@/lib/workspace-context";
import { listFieldDefinitions } from "@/lib/contacts";
import { isWorkspaceGlobal } from "@/lib/workspaces";

// GET /api/fields — list field definitions visible to active workspace
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;

  const workspaceId = await getActiveWorkspaceId(request);
  const isGlobal = await isWorkspaceGlobal(workspaceId);
  const fields = await listFieldDefinitions(workspaceId, isGlobal);

  return NextResponse.json(fields);
}

// POST /api/fields — create a field definition
export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;
  const workspaceId = await getActiveWorkspaceId(request);
  const body = await request.json();
  const parsed = validateBody(CreateFieldInput, body);
  if (!parsed.success) return parsed.error;

  // Auto-determine scope based on workspace context if not explicitly provided
  const isGlobal = await isWorkspaceGlobal(workspaceId);
  let scope = parsed.data.scope || (isGlobal ? "core" : "workspace");
  let fieldWorkspaceId = parsed.data.workspaceId ?? null;

  // Non-global workspaces can only create workspace-scoped fields
  if (!isGlobal) {
    scope = "workspace";
    fieldWorkspaceId = workspaceId;
  }

  // Only global workspace can create core/global_internal fields
  if ((scope === "core" || scope === "global_internal") && !isGlobal) {
    return NextResponse.json(
      { error: "Only the global workspace can create core or global_internal fields." },
      { status: 403 }
    );
  }

  try {
    const [field] = await db
      .insert(fieldDefinitions)
      .values({
        name: parsed.data.name,
        label: parsed.data.label,
        fieldType: parsed.data.fieldType,
        options: parsed.data.options || null,
        required: parsed.data.required,
        sortOrder: parsed.data.sortOrder,
        scope,
        workspaceId: fieldWorkspaceId,
      })
      .returning();

    return NextResponse.json(field, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: `A field with name "${parsed.data.name}" already exists.` },
        { status: 409 }
      );
    }
    throw err;
  }
}
