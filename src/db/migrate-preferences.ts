/**
 * One-time migration: convert communicationPreferences from boolean to string enum.
 * true → "subscribed", false → "unsubscribed", missing keys stay missing (neutral).
 *
 * Usage: npx tsx --env-file=.env src/db/migrate-preferences.ts
 */
import { db } from "./index";
import { sql } from "drizzle-orm";

async function migratePreferences() {
  console.log("Starting communication preferences migration...");

  // Find all contacts that have non-empty communicationPreferences
  const rows = await db.execute(sql`
    SELECT id, communication_preferences
    FROM contacts
    WHERE communication_preferences IS NOT NULL
      AND communication_preferences != '{}'::jsonb
  `);

  console.log(`Found ${rows.length} contacts with preferences to migrate.`);

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    const id = row.id as string;
    const prefs = row.communication_preferences as Record<string, unknown>;

    // Check if already migrated (values are strings, not booleans)
    const values = Object.values(prefs);
    if (values.length > 0 && typeof values[0] === "string") {
      skipped++;
      continue;
    }

    // Convert: true → "subscribed", false → "unsubscribed"
    const newPrefs: Record<string, string> = {};
    for (const [key, value] of Object.entries(prefs)) {
      if (value === true) {
        newPrefs[key] = "subscribed";
      } else if (value === false) {
        newPrefs[key] = "unsubscribed";
      }
      // null/undefined entries are dropped (= neutral)
    }

    await db.execute(sql`
      UPDATE contacts
      SET communication_preferences = ${JSON.stringify(newPrefs)}::jsonb
      WHERE id = ${id}
    `);
    migrated++;
  }

  console.log(`✓ Migrated ${migrated} contacts, skipped ${skipped} (already migrated).`);
  process.exit(0);
}

migratePreferences().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
