import { db } from "@/db";
import { interactions } from "@/db/schema/interactions";
import { emailConnections } from "@/db/schema/email-connections";
import { eq, desc, sql, and, or, isNull } from "drizzle-orm";

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
  params: { page?: number; pageSize?: number; currentUserId?: string } = {}
) {
  const { page = 1, pageSize = 50, currentUserId } = params;
  const offset = (page - 1) * pageSize;

  // Visibility filter: show interactions that are either:
  // 1. Not from email sync (no emailConnectionId — manually logged)
  // 2. Visible to team (visibleToTeam = true)
  // 3. Owned by the current user (their own Gmail sync)
  const visibilityCondition = currentUserId
    ? and(
        eq(interactions.contactId, contactId),
        or(
          isNull(interactions.emailConnectionId),
          eq(interactions.visibleToTeam, true),
          sql`${interactions.emailConnectionId} IN (
            SELECT ${emailConnections.id} FROM ${emailConnections}
            WHERE ${emailConnections.userId} = ${currentUserId}
          )`
        )
      )
    : eq(interactions.contactId, contactId);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(interactions)
    .where(visibilityCondition);

  const items = await db
    .select()
    .from(interactions)
    .where(visibilityCondition)
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
