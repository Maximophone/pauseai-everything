import { z } from "zod";

// ── Connections ────────────────────────────────────────────

export const CreateConnectionInput = z.object({
  name: z.string().min(1, "Name is required"),
  connectorType: z.enum(["airtable", "notion", "google_sheets", "mailchimp", "demo"]),
  credentials: z.record(z.string(), z.unknown()),
});
export type CreateConnectionInput = z.infer<typeof CreateConnectionInput>;

export const UpdateConnectionInput = z.object({
  name: z.string().min(1).optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateConnectionInput = z.infer<typeof UpdateConnectionInput>;

// ── Sync Configurations ───────────────────────────────────

const FieldMappingSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("field"),
    externalFieldId: z.string(),
    externalFieldName: z.string(),
    transform: z.enum(["none", "to_string", "to_number", "to_date", "to_boolean"]).optional(),
  }),
  z.object({
    type: z.literal("constant"),
    value: z.unknown(),
  }),
]);

const FieldMappingEntrySchema = z.object({
  crmTarget: z.string().min(1),
  source: FieldMappingSourceSchema,
});

const FieldMappingSchema = z.object({
  mappings: z.array(FieldMappingEntrySchema).min(1, "At least one field mapping is required"),
});

export const CreateSyncConfigInput = z.object({
  name: z.string().min(1, "Name is required"),
  externalResource: z.record(z.string(), z.unknown()),
  fieldMapping: FieldMappingSchema,
  externalSchema: z
    .array(z.object({ id: z.string(), name: z.string(), type: z.string() }))
    .optional(),
  syncFrequency: z.enum(["manual", "hourly", "daily", "weekly"]).default("manual"),
  duplicateStrategy: z.enum(["skip", "update"]).default("update"),
});
export type CreateSyncConfigInput = z.infer<typeof CreateSyncConfigInput>;

export const UpdateSyncConfigInput = z.object({
  name: z.string().min(1).optional(),
  fieldMapping: FieldMappingSchema.optional(),
  externalSchema: z
    .array(z.object({ id: z.string(), name: z.string(), type: z.string() }))
    .optional(),
  syncFrequency: z.enum(["manual", "hourly", "daily", "weekly"]).optional(),
  duplicateStrategy: z.enum(["skip", "update"]).optional(),
  enabled: z.boolean().optional(),
  status: z.enum(["active", "paused", "needs_repair"]).optional(),
  statusMessage: z.string().nullable().optional(),
});
export type UpdateSyncConfigInput = z.infer<typeof UpdateSyncConfigInput>;

// ── Resource Schema Query ─────────────────────────────────

export const ResourceSchemaQuery = z.object({
  baseId: z.string().optional(),
  tableId: z.string().optional(),
  databaseId: z.string().optional(),
});
export type ResourceSchemaQuery = z.infer<typeof ResourceSchemaQuery>;
