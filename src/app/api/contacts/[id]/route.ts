import { NextRequest, NextResponse } from "next/server";
import {
  getContact,
  getContactForWorkspace,
  updateContact,
  deleteContact,
  removeContactFromWorkspace,
  validateCustomFields,
} from "@/lib/contacts";
import { validateBody } from "@/lib/api-validate";
import { UpdateContactInput } from "@/lib/schemas";
import { checkAuth } from "@/lib/api-auth";
import { getActiveWorkspaceId, requireWorkspaceAdmin, requireWorkspaceMember } from "@/lib/workspace-context";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/contacts/:id
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const authError = await requireWorkspaceMember(authResult, workspaceId);
  if (authError) return authError;

  const { id } = await context.params;

  // Global admins can see any contact; others only see contacts in their workspace
  const contact = authResult.role === "admin"
    ? await getContact(id)
    : await getContactForWorkspace(id, workspaceId);

  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  return NextResponse.json(contact);
}

// PUT /api/contacts/:id
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const memberError = await requireWorkspaceMember(authResult, workspaceId);
  if (memberError) return memberError;

  const { id } = await context.params;

  // Verify contact belongs to the active workspace (global admins bypass)
  const contact = authResult.role === "admin"
    ? await getContact(id)
    : await getContactForWorkspace(id, workspaceId);

  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const body = await request.json();
  const parsed = validateBody(UpdateContactInput, body);
  if (!parsed.success) return parsed.error;

  // Validate custom fields if provided
  if (parsed.data.customFields && Object.keys(parsed.data.customFields).length > 0) {
    const validation = await validateCustomFields(parsed.data.customFields);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed.", details: validation.errors },
        { status: 400 }
      );
    }
  }

  const updated = await updateContact(id, {
    ...(parsed.data.email !== undefined && { email: parsed.data.email }),
    ...(parsed.data.firstName !== undefined && { firstName: parsed.data.firstName }),
    ...(parsed.data.lastName !== undefined && { lastName: parsed.data.lastName }),
    ...(parsed.data.language !== undefined && { language: parsed.data.language }),
    ...(parsed.data.globallyUnsubscribed !== undefined && { globallyUnsubscribed: parsed.data.globallyUnsubscribed }),
    ...(parsed.data.customFields !== undefined && { customFields: parsed.data.customFields }),
    ...(parsed.data.communicationPreferences !== undefined && { communicationPreferences: parsed.data.communicationPreferences }),
  });

  if (!updated) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/contacts/:id
// Global admins delete the contact globally.
// Workspace admins remove the contact from the active workspace only
// (and delete the record if it has no remaining workspace links).
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const authError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (authError) return authError;

  const { id } = await context.params;

  // Global admins: hard delete the contact entirely
  if (authResult.role === "admin") {
    const deleted = await deleteContact(id);
    if (!deleted) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }

  // Workspace admins: remove from workspace only
  const removed = await removeContactFromWorkspace(id, workspaceId);
  if (!removed) {
    return NextResponse.json({ error: "Contact not found in this workspace." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
