import { db } from "@/db";
import { tags, contactTags } from "@/db/schema/tags";
import { eq, sql, asc } from "drizzle-orm";
import { and } from "drizzle-orm";

export type Tag = typeof tags.$inferSelect;

export async function listTags(workspaceId?: string) {
  if (workspaceId) {
    return db
      .select()
      .from(tags)
      .where(eq(tags.workspaceId, workspaceId))
      .orderBy(asc(tags.name));
  }
  return db.select().from(tags).orderBy(asc(tags.name));
}

export async function createTag(
  name: string,
  color?: string,
  workspaceId?: string
) {
  const [tag] = await db
    .insert(tags)
    .values({ name, color: color || null, workspaceId: workspaceId || null })
    .returning();
  return tag;
}

export async function updateTag(id: string, data: { name?: string; color?: string }) {
  const [tag] = await db
    .update(tags)
    .set(data)
    .where(eq(tags.id, id))
    .returning();
  return tag;
}

export async function deleteTag(id: string) {
  const result = await db
    .delete(tags)
    .where(eq(tags.id, id))
    .returning({ id: tags.id });
  return result.length > 0;
}

export async function getTagsForContact(contactId: string, workspaceId?: string) {
  const conditions = [eq(contactTags.contactId, contactId)];
  if (workspaceId) {
    conditions.push(eq(tags.workspaceId, workspaceId));
  }
  const result = await db
    .select({ tag: tags })
    .from(contactTags)
    .innerJoin(tags, eq(contactTags.tagId, tags.id))
    .where(and(...conditions));
  return result.map((r) => r.tag);
}

export async function addTagToContact(contactId: string, tagId: string) {
  await db
    .insert(contactTags)
    .values({ contactId, tagId })
    .onConflictDoNothing();
}

export async function removeTagFromContact(contactId: string, tagId: string) {
  await db
    .delete(contactTags)
    .where(
      and(
        eq(contactTags.contactId, contactId),
        eq(contactTags.tagId, tagId)
      )
    );
}

/**
 * Fetch tags for multiple contacts at once (batch query).
 * Returns a map of contactId → tag names.
 */
export async function getTagsForContacts(
  contactIds: string[],
  workspaceId?: string
): Promise<Record<string, string[]>> {
  if (contactIds.length === 0) return {};

  const conditions = [
    sql`${contactTags.contactId} IN (${sql.join(contactIds.map(id => sql`${id}`), sql`, `)})`
  ];
  if (workspaceId) {
    conditions.push(sql`${tags.workspaceId} = ${workspaceId}`);
  }

  const result = await db
    .select({
      contactId: contactTags.contactId,
      tagName: tags.name,
    })
    .from(contactTags)
    .innerJoin(tags, eq(contactTags.tagId, tags.id))
    .where(sql`${sql.join(conditions, sql` AND `)}`);

  const map: Record<string, string[]> = {};
  for (const row of result) {
    if (!map[row.contactId]) map[row.contactId] = [];
    map[row.contactId].push(row.tagName);
  }
  return map;
}

export async function getContactCountByTag(tagId: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contactTags)
    .where(eq(contactTags.tagId, tagId));
  return Number(result.count);
}
