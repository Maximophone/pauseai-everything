import { db } from "@/db";
import { users } from "@/db/schema/users";
import { apiKeys } from "@/db/schema/api-keys";
import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { sendEmail } from "@/lib/mailersend";
import type { UserRole } from "@/db/schema/users";

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

/**
 * Invite a new user by email. Creates a user record (so they can sign in)
 * and optionally sends an invitation email via Mailersend.
 */
export async function inviteUser(email: string, role: UserRole = "viewer", invitedByName?: string) {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const existing = await getUserByEmail(normalizedEmail);
  if (existing) {
    return { user: existing, alreadyExists: true };
  }

  // Create the user record (no name yet — will be populated on first sign-in via Google)
  const [user] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      role,
    })
    .returning();

  // Send invitation email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const fromEmail = process.env.MAILERSEND_FROM_EMAIL;

  if (fromEmail) {
    const inviterLine = invitedByName
      ? `${invitedByName} has invited you`
      : "You have been invited";

    await sendEmail({
      to: [{ email: normalizedEmail }],
      from: { email: fromEmail, name: "PauseAI" },
      subject: "You're invited to PauseAI CRM",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Welcome to PauseAI CRM</h2>
          <p>${inviterLine} to join the PauseAI CRM platform.</p>
          <p>Click the button below to sign in with your Google account:</p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${appUrl}/login"
               style="background: #0f172a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
              Sign in to PauseAI CRM
            </a>
          </p>
          <p style="color: #64748b; font-size: 14px;">
            Make sure to sign in with this email address (${normalizedEmail}).
          </p>
        </div>
      `,
    });
  }

  return { user, alreadyExists: false };
}

/**
 * Delete a user and their linked accounts.
 * Cascade delete on the accounts/sessions tables handles cleanup.
 */
export async function deleteUser(id: string) {
  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id, email: users.email });
  return deleted || null;
}

export async function updateUserRole(id: string, role: UserRole) {
  const [user] = await db
    .update(users)
    .set({ role })
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
