import { pgTable, uuid, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * A segment condition looks like:
 * { field: "country", operator: "eq", value: "Netherlands" }
 * { field: "lifecycle_stage", operator: "in", value: ["active", "highly_active"] }
 * { field: "tag", operator: "has", value: "newsletter" }
 * { field: "created_at", operator: "after", value: "2025-01-01" }
 *
 * conditions is an array of these, combined with the `match` field (all = AND, any = OR).
 */
export type SegmentCondition = {
  field: string;
  operator: string;
  value: unknown;
};

export type SegmentFilter = {
  match: "all" | "any";
  conditions: SegmentCondition[];
};

export const segments = pgTable("segments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  filter: jsonb("filter").$type<SegmentFilter>().notNull(),
  workspaceId: uuid("workspace_id"), // FK to workspaces(id)
  crossWorkspace: boolean("cross_workspace").default(false).notNull(),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Segment = typeof segments.$inferSelect;
export type NewSegment = typeof segments.$inferInsert;
