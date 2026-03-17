import { db } from "@/db";
import { users } from "@/db/schema/users";
import { apiKeys } from "@/db/schema/api-keys";
import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";

// ── Users ──────────────────────────────────────────────────

export async function listUsers() {
  return db.select().from(users);
}

export async function getUser(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function getUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

export async function updateUserRole(id: string, isAdmin: boolean) {
  const [user] = await db
    .update(users)
    .set({ isAdmin })
    .where(eq(users.id, id))
    .returning();
  return user;
}

// ── API Keys ───────────────────────────────────────────────

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `pai_${randomBytes(32).toString("hex")}`;
  const prefix = key.slice(0, 12);
  const hash = hashKey(key);
  return { key, prefix, hash };
}

export async function createApiKey(userId: string, name: string) {
  const { key, prefix, hash } = generateApiKey();

  const [apiKey] = await db
    .insert(apiKeys)
    .values({
      name,
      keyHash: hash,
      keyPrefix: prefix,
      userId,
    })
    .returning();

  // Return the raw key only once — it won't be retrievable after this
  return { ...apiKey, rawKey: key };
}

export async function listApiKeys(userId?: string) {
  if (userId) {
    return db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId));
  }
  return db.select().from(apiKeys);
}

export async function deleteApiKey(id: string) {
  const result = await db
    .delete(apiKeys)
    .where(eq(apiKeys.id, id))
    .returning({ id: apiKeys.id });
  return result.length > 0;
}

export async function validateApiKey(key: string) {
  const hash = hashKey(key);
  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash));

  if (!apiKey || !apiKey.isActive) return null;

  // Update last used timestamp
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKey.id));

  return apiKey;
}
