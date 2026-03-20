import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema/contacts";
import { communicationCategories } from "@/db/schema/communication-categories";
import { eq } from "drizzle-orm";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-tokens";
import { validateBody } from "@/lib/api-validate";
import { UnsubscribeInput } from "@/lib/schemas";

/**
 * Public endpoint — authenticated by HMAC token, no session required.
 * Updates a contact's communication preferences.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = validateBody(UnsubscribeInput, body);
  if (!parsed.success) return parsed.error;

  const { contactId, category, token, preferences } = parsed.data;

  // Verify the HMAC token
  if (!verifyUnsubscribeToken(contactId, category, token)) {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 403 });
  }

  // Fetch the contact
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId));

  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const currentPrefs = (contact.communicationPreferences as Record<string, boolean>) || {};

  if (preferences) {
    // Bulk update — user toggled multiple categories from the preference center
    // Only allow toggling categories that actually exist
    const allCats = await db.select({ name: communicationCategories.name }).from(communicationCategories);
    const validNames = new Set(allCats.map((c) => c.name));

    const newPrefs = { ...currentPrefs };
    for (const [key, value] of Object.entries(preferences)) {
      if (validNames.has(key)) {
        if (value) {
          delete newPrefs[key]; // opted-in = remove key (default is opted-in)
        } else {
          newPrefs[key] = false;
        }
      }
    }

    await db
      .update(contacts)
      .set({ communicationPreferences: newPrefs, updatedAt: new Date() })
      .where(eq(contacts.id, contactId));
  } else {
    // One-click unsubscribe — just opt out of the specified category
    const newPrefs = { ...currentPrefs, [category]: false };

    await db
      .update(contacts)
      .set({ communicationPreferences: newPrefs, updatedAt: new Date() })
      .where(eq(contacts.id, contactId));
  }

  return NextResponse.json({ success: true });
}
