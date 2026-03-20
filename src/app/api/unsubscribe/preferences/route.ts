import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema/contacts";
import { communicationCategories } from "@/db/schema/communication-categories";
import { eq, asc } from "drizzle-orm";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-tokens";

/**
 * Public GET endpoint — returns all categories with the contact's opt-in/out status.
 * Authenticated by HMAC token (query params), no session required.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contact");
  const category = searchParams.get("category");
  const token = searchParams.get("token");

  if (!contactId || !category || !token) {
    return NextResponse.json({ error: "Missing parameters." }, { status: 400 });
  }

  if (!verifyUnsubscribeToken(contactId, category, token)) {
    return NextResponse.json({ error: "Invalid token." }, { status: 403 });
  }

  const [contact] = await db
    .select({ communicationPreferences: contacts.communicationPreferences })
    .from(contacts)
    .where(eq(contacts.id, contactId));

  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const allCategories = await db
    .select()
    .from(communicationCategories)
    .orderBy(asc(communicationCategories.sortOrder));

  const prefs = (contact.communicationPreferences as Record<string, boolean>) || {};

  const categories = allCategories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    label: cat.label,
    description: cat.description,
    optedOut: prefs[cat.name] === false,
  }));

  return NextResponse.json({ categories });
}
