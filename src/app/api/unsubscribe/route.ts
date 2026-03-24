import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema/contacts";
import { contactWorkspaces } from "@/db/schema/workspaces";
import { communicationCategories } from "@/db/schema/communication-categories";
import { eq, and } from "drizzle-orm";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-tokens";
import { validateBody } from "@/lib/api-validate";
import { UnsubscribeInput } from "@/lib/schemas";

/**
 * Public endpoint — authenticated by HMAC token, no session required.
 * Updates a contact's communication preferences (workspace-scoped).
 *
 * Preference keys are namespaced: "workspaceId:categoryName"
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = validateBody(UnsubscribeInput, body);
  if (!parsed.success) return parsed.error;

  const {
    contactId,
    workspaceId,
    category,
    token,
    preferences,
    unsubscribeFromWorkspace,
    globalUnsubscribe,
  } = parsed.data;

  // Verify the HMAC token
  if (!verifyUnsubscribeToken(contactId, workspaceId, category, token)) {
    return NextResponse.json(
      { error: "Invalid or expired token." },
      { status: 403 }
    );
  }

  // Fetch the contact
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId));

  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  // Handle global unsubscribe
  if (globalUnsubscribe) {
    await db
      .update(contacts)
      .set({ globallyUnsubscribed: true, updatedAt: new Date() })
      .where(eq(contacts.id, contactId));
    return NextResponse.json({ success: true });
  }

  // Handle workspace-level unsubscribe
  if (unsubscribeFromWorkspace) {
    await db
      .update(contactWorkspaces)
      .set({ subscriptionStatus: "unsubscribed" })
      .where(
        and(
          eq(contactWorkspaces.contactId, contactId),
          eq(contactWorkspaces.workspaceId, unsubscribeFromWorkspace)
        )
      );
    return NextResponse.json({ success: true });
  }

  const currentPrefs =
    (contact.communicationPreferences as Record<
      string,
      "subscribed" | "unsubscribed"
    >) || {};

  if (preferences) {
    // Bulk update — user toggled multiple categories from the preference center
    // Keys are "workspaceId:categoryName" format
    // Validate that each category actually exists
    const allCats = await db
      .select({
        name: communicationCategories.name,
        workspaceId: communicationCategories.workspaceId,
      })
      .from(communicationCategories);

    const validKeys = new Set(
      allCats.map((c) => `${c.workspaceId}:${c.name}`)
    );

    const newPrefs = { ...currentPrefs };
    for (const [key, value] of Object.entries(preferences)) {
      if (validKeys.has(key)) {
        newPrefs[key] = value;
      }
    }

    await db
      .update(contacts)
      .set({ communicationPreferences: newPrefs, updatedAt: new Date() })
      .where(eq(contacts.id, contactId));
  } else {
    // One-click unsubscribe — opt out of the specified category in the specified workspace
    const prefKey = `${workspaceId}:${category}`;
    const newPrefs = { ...currentPrefs, [prefKey]: "unsubscribed" as const };

    await db
      .update(contacts)
      .set({ communicationPreferences: newPrefs, updatedAt: new Date() })
      .where(eq(contacts.id, contactId));
  }

  return NextResponse.json({ success: true });
}
