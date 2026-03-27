import { db } from "@/db";
import { appSettings } from "@/db/schema/app-settings";
import { eq } from "drizzle-orm";

/**
 * Get a setting value by key. Returns null if not set.
 */
export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key));
  return row?.value ?? null;
}

/**
 * Get a boolean setting. Returns the default if not set.
 */
export async function getBooleanSetting(
  key: string,
  defaultValue = false
): Promise<boolean> {
  const val = await getSetting(key);
  if (val === null) return defaultValue;
  return val === "true";
}

/**
 * Set a setting value (upsert).
 */
export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

/**
 * Get all settings as a key-value map.
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(appSettings);
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

// ── Well-known setting keys ─────────────────────────────────────────

export const SETTING_KEYS = {
  /** Whether to send list_unsubscribe param to Mailersend (requires Professional+ plan) */
  MAILERSEND_LIST_UNSUBSCRIBE: "mailersend_list_unsubscribe_enabled",
  /** MailerSend API key (overrides MAILERSEND_API_KEY env var) */
  MAILERSEND_API_KEY: "mailersend_api_key",
  /** MailerSend from email address (overrides MAILERSEND_FROM_EMAIL env var) */
  MAILERSEND_FROM_EMAIL: "mailersend_from_email",
} as const;

/** Keys whose values should be masked in API responses */
export const SENSITIVE_SETTING_KEYS = new Set<string>([
  SETTING_KEYS.MAILERSEND_API_KEY,
]);

/** Mask a sensitive value — shows only the last 4 chars */
export function maskSettingValue(value: string): string {
  if (value.length <= 4) return "****";
  return "****" + value.slice(-4);
}
