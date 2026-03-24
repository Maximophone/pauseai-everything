import { pgTable, uuid, text, boolean, integer, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const fieldDefinitions = pgTable(
  "field_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    label: text("label").notNull(),
    fieldType: text("field_type").notNull(), // text, number, date, select, multiselect, boolean, url
    options: jsonb("options").$type<string[]>(), // for select/multiselect
    required: boolean("required").default(false),
    sortOrder: integer("sort_order").default(0),
    // Workspace scoping
    scope: text("scope").notNull().default("core"), // "core" | "global_internal" | "workspace"
    workspaceId: uuid("workspace_id"), // null for core/global_internal, set for workspace-scoped
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_field_definitions_name_workspace").on(
      table.name,
      table.workspaceId
    ),
  ]
);
