import { db } from "@/db";
import { communicationCategories } from "@/db/schema/communication-categories";
import { eq, asc } from "drizzle-orm";

export async function listCategories(workspaceId?: string) {
  if (workspaceId) {
    return db
      .select()
      .from(communicationCategories)
      .where(eq(communicationCategories.workspaceId, workspaceId))
      .orderBy(asc(communicationCategories.sortOrder));
  }
  return db
    .select()
    .from(communicationCategories)
    .orderBy(asc(communicationCategories.sortOrder));
}

export async function getCategory(id: string) {
  const [cat] = await db
    .select()
    .from(communicationCategories)
    .where(eq(communicationCategories.id, id));
  return cat ?? null;
}

export async function getCategoryByName(name: string) {
  const [cat] = await db
    .select()
    .from(communicationCategories)
    .where(eq(communicationCategories.name, name));
  return cat ?? null;
}

export async function createCategory(data: {
  name: string;
  label: string;
  description?: string;
  sortOrder?: number;
  workspaceId?: string;
}) {
  const [cat] = await db
    .insert(communicationCategories)
    .values(data)
    .returning();
  return cat;
}

export async function updateCategory(
  id: string,
  data: Partial<{
    name: string;
    label: string;
    description: string;
    sortOrder: number;
  }>
) {
  const [updated] = await db
    .update(communicationCategories)
    .set(data)
    .where(eq(communicationCategories.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteCategory(id: string) {
  const result = await db
    .delete(communicationCategories)
    .where(eq(communicationCategories.id, id))
    .returning({ id: communicationCategories.id });
  return result.length > 0;
}
