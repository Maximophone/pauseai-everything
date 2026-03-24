import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema/contacts";
import { contactWorkspaces, workspaces } from "@/db/schema/workspaces";
import { communicationCategories } from "@/db/schema/communication-categories";
import { eq, and, asc } from "drizzle-orm";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-tokens";

/**
 * Public GET endpoint — returns categories grouped by workspace with the contact's preferences.
 * Authenticated by HMAC token (query params), no session required.
 *
 * Only returns workspaces the contact is linked to.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contact");
  const workspaceId = searchParams.get("workspace");
  const category = searchParams.get("category");
  const token = searchParams.get("token");

  if (!contactId || !workspaceId || !category || !token) {
    return NextResponse.json({ error: "Missing parameters." }, { status: 400 });
  }

  if (!verifyUnsubscribeToken(contactId, workspaceId, category, token)) {
    return NextResponse.json({ error: "Invalid token." }, { status: 403 });
  }

  // Fetch contact
  const [contact] = await db
    .select({
      communicationPreferences: contacts.communicationPreferences,
      globallyUnsubscribed: contacts.globallyUnsubscribed,
    })
    .from(contacts)
    .where(eq(contacts.id, contactId));

  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  // Get all workspaces this contact is linked to
  const contactWsRows = await db
    .select({
      workspaceId: contactWorkspaces.workspaceId,
      subscriptionStatus: contactWorkspaces.subscriptionStatus,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
      workspaceType: workspaces.type,
    })
    .from(contactWorkspaces)
    .innerJoin(workspaces, eq(workspaces.id, contactWorkspaces.workspaceId))
    .where(eq(contactWorkspaces.contactId, contactId));

  // Get all communication categories for those workspaces
  const wsIds = contactWsRows.map((r) => r.workspaceId);
  const allCategories =
    wsIds.length > 0
      ? await db
          .select()
          .from(communicationCategories)
          .orderBy(asc(communicationCategories.sortOrder))
      : [];

  // Filter to only categories belonging to linked workspaces
  const wsCategoryMap = new Map<string, typeof allCategories>();
  for (const cat of allCategories) {
    if (cat.workspaceId && wsIds.includes(cat.workspaceId)) {
      const list = wsCategoryMap.get(cat.workspaceId) || [];
      list.push(cat);
      wsCategoryMap.set(cat.workspaceId, list);
    }
  }

  const prefs =
    (contact.communicationPreferences as Record<
      string,
      "subscribed" | "unsubscribed"
    >) || {};

  // Build workspace sections
  const workspaceSections = contactWsRows.map((ws) => {
    const cats = wsCategoryMap.get(ws.workspaceId) || [];
    return {
      workspaceId: ws.workspaceId,
      workspaceName: ws.workspaceName,
      workspaceSlug: ws.workspaceSlug,
      workspaceType: ws.workspaceType,
      subscriptionStatus: ws.subscriptionStatus,
      categories: cats.map((cat) => {
        const prefKey = `${ws.workspaceId}:${cat.name}`;
        // Also check legacy flat key for backward compatibility
        const status =
          prefs[prefKey] ?? prefs[cat.name] ?? ("neutral" as const);
        return {
          id: cat.id,
          name: cat.name,
          label: cat.label,
          description: cat.description,
          status: status as "subscribed" | "unsubscribed" | "neutral",
        };
      }),
    };
  });

  return NextResponse.json({
    globallyUnsubscribed: contact.globallyUnsubscribed,
    workspaces: workspaceSections,
  });
}
