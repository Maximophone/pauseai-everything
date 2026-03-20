import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Simple key-value store for app-level settings.
 * Values are stored as text (JSON-stringified for non-string values).
 */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
