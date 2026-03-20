import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

// ---------- connections ----------

export const connections = pgTable("connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  connectorType: text("connector_type").notNull(), // "airtable" | "notion" | "google_sheets" | "mailchimp"
  credentials: jsonb("credentials")
    .$type<Record<string, unknown>>()
    .notNull(),
  status: text("status").notNull().default("untested"), // "connected" | "error" | "untested"
  statusMessage: text("status_message"),
  lastTestedAt: timestamp("last_tested_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------- sync_configurations ----------

export type FieldMappingEntry = {
  externalFieldId: string;
  externalFieldName: string;
  crmTarget: string; // "_email" | "_firstName" | "_lastName" | field definition name
  transform?: "none" | "to_string" | "to_number" | "to_date" | "to_boolean";
};

export type FieldMapping = {
  mappings: FieldMappingEntry[];
};

export type ExternalSchemaField = {
  id: string;
  name: string;
  type: string;
};

export const syncConfigurations = pgTable("sync_configurations", {
  id: uuid("id").defaultRandom().primaryKey(),
  connectionId: uuid("connection_id")
    .notNull()
    .references(() => connections.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  direction: text("direction").notNull().default("inbound"), // "inbound" (future: "outbound")
  externalResource: jsonb("external_resource")
    .$type<Record<string, unknown>>()
    .notNull(),
  fieldMapping: jsonb("field_mapping").$type<FieldMapping>().notNull(),
  externalSchema: jsonb("external_schema")
    .$type<ExternalSchemaField[]>()
    .default([]),
  syncFrequency: text("sync_frequency").notNull().default("manual"), // "manual" | "hourly" | "daily" | "weekly"
  duplicateStrategy: text("duplicate_strategy").notNull().default("update"), // "skip" | "update"
  status: text("status").notNull().default("active"), // "active" | "paused" | "needs_repair" | "error"
  statusMessage: text("status_message"),
  enabled: boolean("enabled").default(true).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: text("last_sync_status"), // "success" | "partial" | "error"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------- sync_runs ----------

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  syncConfigurationId: uuid("sync_configuration_id")
    .notNull()
    .references(() => syncConfigurations.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // "running" | "success" | "partial" | "error"
  log: text("log"),
  error: text("error"),
  recordsFetched: integer("records_fetched").default(0).notNull(),
  recordsCreated: integer("records_created").default(0).notNull(),
  recordsUpdated: integer("records_updated").default(0).notNull(),
  recordsSkipped: integer("records_skipped").default(0).notNull(),
  recordsErrored: integer("records_errored").default(0).notNull(),
  triggeredBy: text("triggered_by").notNull(), // "manual" | "scheduled"
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
export type SyncConfiguration = typeof syncConfigurations.$inferSelect;
export type NewSyncConfiguration = typeof syncConfigurations.$inferInsert;
export type SyncRun = typeof syncRuns.$inferSelect;
