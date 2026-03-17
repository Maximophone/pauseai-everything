import { db } from "@/db";
import { interactions } from "@/db/schema/interactions";
import { eq, desc, sql } from "drizzle-orm";

export type Interaction = typeof interactions.$inferSelect;
export type NewInteraction = typeof interactions.$inferInsert;

export const INTERACTION_TYPES = [
  "email_sent",
  "email_received",
  "call",
  "meeting",
  "note",
  "form_submission",
  "event_attended",
  "action_taken",
  "stage_change",
] as const;

export async function listInteractionsByContact(
  contactId: string,
  params: { page?: number; pageSize?: number } = {}
) {
  const { page = 1, pageSize = 50 } = params;
  const offset = (page - 1) * pageSize;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(interactions)
    .where(eq(interactions.contactId, contactId));

  const items = await db
    .select()
    .from(interactions)
    .where(eq(interactions.contactId, contactId))
    .orderBy(desc(interactions.occurredAt))
    .limit(pageSize)
    .offset(offset);

  return {
    interactions: items,
    total: Number(countResult.count),
    page,
    pageSize,
  };
}

export async function getInteraction(id: string) {
  const [interaction] = await db
    .select()
    .from(interactions)
    .where(eq(interactions.id, id));
  return interaction;
}

export async function createInteraction(data: NewInteraction) {
  const [interaction] = await db
    .insert(interactions)
    .values(data)
    .returning();
  return interaction;
}

export async function deleteInteraction(id: string) {
  const result = await db
    .delete(interactions)
    .where(eq(interactions.id, id))
    .returning({ id: interactions.id });
  return result.length > 0;
}
