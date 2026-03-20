import { db } from "@/db";
import {
  connections,
  syncConfigurations,
  syncRuns,
  type SyncConfiguration,
  type FieldMappingEntry,
  type ExternalSchemaField,
} from "@/db/schema/connections";
import { contacts } from "@/db/schema/contacts";
import { fieldDefinitions } from "@/db/schema/field-definitions";
import { eq, and, asc } from "drizzle-orm";
import { getConnector } from "./connectors";

// ── Types ──────────────────────────────────────────────────

type SyncRunContext = {
  runId: string;
  logLines: string[];
  counts: {
    fetched: number;
    created: number;
    updated: number;
    skipped: number;
    errored: number;
  };
};

// ── Public API ─────────────────────────────────────────────

export async function executeSyncRun(
  syncConfigurationId: string,
  triggeredBy: "manual" | "scheduled"
): Promise<{ runId: string; status: string }> {
  // Load sync config + connection
  const [config] = await db
    .select()
    .from(syncConfigurations)
    .where(eq(syncConfigurations.id, syncConfigurationId));

  if (!config) {
    throw new Error(`Sync configuration ${syncConfigurationId} not found`);
  }

  const [connection] = await db
    .select()
    .from(connections)
    .where(eq(connections.id, config.connectionId));

  if (!connection) {
    throw new Error(`Connection ${config.connectionId} not found`);
  }

  // Lock check: skip if another run is in progress
  const activeRun = await checkForActiveRun(syncConfigurationId);
  if (activeRun) {
    return { runId: activeRun, status: "skipped_active_run" };
  }

  // Create sync run record
  const [run] = await db
    .insert(syncRuns)
    .values({
      syncConfigurationId,
      status: "running",
      triggeredBy,
    })
    .returning();

  const ctx: SyncRunContext = {
    runId: run.id,
    logLines: [],
    counts: { fetched: 0, created: 0, updated: 0, skipped: 0, errored: 0 },
  };

  try {
    const connector = getConnector(connection.connectorType as Parameters<typeof getConnector>[0]);

    // Step 1: Test connection
    log(ctx, "Testing connection...");
    try {
      await connector.testConnection(connection.credentials);
      log(ctx, "Connection OK");
    } catch (err) {
      await db
        .update(connections)
        .set({ status: "error", statusMessage: errorMessage(err), updatedAt: new Date() })
        .where(eq(connections.id, connection.id));
      throw new Error(`Connection test failed: ${errorMessage(err)}`);
    }

    // Step 2: Validate external schema
    log(ctx, "Validating external schema...");
    const currentSchema = await connector.getSchema(
      connection.credentials,
      config.externalResource
    );
    log(ctx, `Found ${currentSchema.length} external fields`);

    const schemaIssues = validateExternalSchema(config, currentSchema);
    if (schemaIssues.length > 0) {
      await markNeedsRepair(config.id, `External schema changed: ${schemaIssues.join("; ")}`);
      throw new Error(`Schema validation failed: ${schemaIssues.join("; ")}`);
    }

    // Step 3: Validate CRM schema
    log(ctx, "Validating CRM schema...");
    const crmIssues = await validateCrmSchema(config);
    if (crmIssues.length > 0) {
      await markNeedsRepair(config.id, `CRM schema changed: ${crmIssues.join("; ")}`);
      throw new Error(`CRM schema validation failed: ${crmIssues.join("; ")}`);
    }
    log(ctx, "Schema validation passed");

    // Step 4: Fetch all records
    log(ctx, "Fetching records...");
    const allRecords = await fetchAllRecords(connector, connection.credentials, config.externalResource, ctx);
    ctx.counts.fetched = allRecords.length;
    log(ctx, `Fetched ${allRecords.length} records total`);

    // Step 5: Process records
    log(ctx, "Processing records...");
    await processRecords(allRecords, config, ctx);

    // Finalize as success or partial
    const finalStatus = ctx.counts.errored > 0 ? "partial" : "success";
    log(
      ctx,
      `Complete: ${ctx.counts.created} created, ${ctx.counts.updated} updated, ${ctx.counts.skipped} skipped, ${ctx.counts.errored} errored`
    );

    await finalizeRun(ctx, finalStatus);
    await updateSyncConfigAfterRun(config.id, finalStatus);

    // Update connection status to connected on success
    await db
      .update(connections)
      .set({ status: "connected", statusMessage: "OK", lastTestedAt: new Date(), updatedAt: new Date() })
      .where(eq(connections.id, connection.id));

    return { runId: run.id, status: finalStatus };
  } catch (err) {
    log(ctx, `FATAL: ${errorMessage(err)}`);
    await finalizeRun(ctx, "error", errorMessage(err));
    await updateSyncConfigAfterRun(config.id, "error");
    return { runId: run.id, status: "error" };
  }
}

// ── Internals ──────────────────────────────────────────────

async function checkForActiveRun(syncConfigurationId: string): Promise<string | null> {
  const [activeRun] = await db
    .select()
    .from(syncRuns)
    .where(
      and(
        eq(syncRuns.syncConfigurationId, syncConfigurationId),
        eq(syncRuns.status, "running")
      )
    );

  if (!activeRun) return null;

  // If older than 30 minutes, mark as timed out
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  if (activeRun.startedAt < thirtyMinutesAgo) {
    await db
      .update(syncRuns)
      .set({
        status: "error",
        error: "Timed out (exceeded 30 minutes)",
        completedAt: new Date(),
      })
      .where(eq(syncRuns.id, activeRun.id));
    return null;
  }

  return activeRun.id;
}

function validateExternalSchema(
  config: SyncConfiguration,
  currentSchema: ExternalSchemaField[]
): string[] {
  const issues: string[] = [];
  const currentFieldIds = new Set(currentSchema.map((f) => f.id));
  const mapping = config.fieldMapping;

  if (!mapping?.mappings) return issues;

  for (const entry of mapping.mappings) {
    if (!currentFieldIds.has(entry.externalFieldId)) {
      issues.push(
        `External field "${entry.externalFieldName}" (ID: ${entry.externalFieldId}) no longer exists`
      );
    }
  }

  return issues;
}

async function validateCrmSchema(config: SyncConfiguration): Promise<string[]> {
  const issues: string[] = [];
  const mapping = config.fieldMapping;

  if (!mapping?.mappings) return issues;

  const coreFields = new Set(["_email", "_firstName", "_lastName"]);
  const customTargets = mapping.mappings
    .map((m) => m.crmTarget)
    .filter((t) => !coreFields.has(t));

  if (customTargets.length === 0) return issues;

  const definitions = await db
    .select()
    .from(fieldDefinitions)
    .orderBy(asc(fieldDefinitions.sortOrder));
  const definedNames = new Set(definitions.map((d) => d.name));

  for (const target of customTargets) {
    if (!definedNames.has(target)) {
      issues.push(`CRM field "${target}" no longer exists in field definitions`);
    }
  }

  return issues;
}

async function fetchAllRecords(
  connector: ReturnType<typeof getConnector>,
  credentials: Record<string, unknown>,
  resource: Record<string, unknown>,
  ctx: SyncRunContext
) {
  const allRecords: { externalId: string; fields: Record<string, unknown> }[] = [];
  let cursor: string | undefined;
  let page = 1;

  do {
    const result = await connector.fetchRecords(credentials, resource, cursor);
    allRecords.push(...result.records);
    log(ctx, `Page ${page}: ${result.records.length} records`);
    cursor = result.cursor;
    page++;
  } while (cursor);

  return allRecords;
}

async function processRecords(
  records: { externalId: string; fields: Record<string, unknown> }[],
  config: SyncConfiguration,
  ctx: SyncRunContext
) {
  const mapping = config.fieldMapping;
  if (!mapping?.mappings) return;

  // Build a lookup from external field ID → mapping entry
  const mappingByExternalId = new Map<string, FieldMappingEntry>();
  for (const entry of mapping.mappings) {
    mappingByExternalId.set(entry.externalFieldId, entry);
  }

  // Build a lookup from external field name → mapping entry (fallback)
  const mappingByExternalName = new Map<string, FieldMappingEntry>();
  for (const entry of mapping.mappings) {
    mappingByExternalName.set(entry.externalFieldName, entry);
  }

  for (let i = 0; i < records.length; i++) {
    try {
      const record = records[i];
      const mapped = applyMapping(record.fields, mappingByExternalId, mappingByExternalName, ctx, i);

      if (!mapped.email) {
        log(ctx, `Row ${i + 1}: skipped (no email)`);
        ctx.counts.skipped++;
        continue;
      }

      const email = mapped.email.toLowerCase().trim();

      // Check for existing contact
      const [existing] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.email, email));

      if (existing) {
        if (config.duplicateStrategy === "skip") {
          ctx.counts.skipped++;
          continue;
        }

        // Update: external wins for mapped fields
        const mergedFields = { ...existing.customFields, ...mapped.customFields };
        await db
          .update(contacts)
          .set({
            firstName: mapped.firstName || existing.firstName,
            lastName: mapped.lastName || existing.lastName,
            customFields: mergedFields,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, existing.id));
        ctx.counts.updated++;
      } else {
        // Create new contact
        await db.insert(contacts).values({
          email,
          firstName: mapped.firstName,
          lastName: mapped.lastName,
          customFields: mapped.customFields,
        });
        ctx.counts.created++;
      }
    } catch (err) {
      log(ctx, `Row ${i + 1}: error — ${errorMessage(err)}`);
      ctx.counts.errored++;
    }
  }
}

function applyMapping(
  fields: Record<string, unknown>,
  mappingByExternalId: Map<string, FieldMappingEntry>,
  mappingByExternalName: Map<string, FieldMappingEntry>,
  ctx: SyncRunContext,
  rowIndex: number
): {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  customFields: Record<string, unknown>;
} {
  let email: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  const customFields: Record<string, unknown> = {};

  for (const [fieldKey, rawValue] of Object.entries(fields)) {
    // Try to find mapping by external field ID first, then by name
    const entry = mappingByExternalId.get(fieldKey) || mappingByExternalName.get(fieldKey);
    if (!entry) continue;

    const value = coerceValue(rawValue, entry.transform);
    if (value === null || value === undefined) continue;

    switch (entry.crmTarget) {
      case "_email":
        email = String(value);
        break;
      case "_firstName":
        firstName = String(value);
        break;
      case "_lastName":
        lastName = String(value);
        break;
      default:
        customFields[entry.crmTarget] = value;
    }
  }

  return { email, firstName, lastName, customFields };
}

function coerceValue(
  value: unknown,
  transform?: string
): unknown {
  if (value === null || value === undefined || value === "") return null;

  switch (transform) {
    case "to_string":
      return String(value);
    case "to_number": {
      const n = Number(value);
      return isNaN(n) ? null : n;
    }
    case "to_date": {
      const d = new Date(value as string);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    case "to_boolean":
      return Boolean(value);
    default:
      // Pass through — handle arrays, objects, etc.
      if (Array.isArray(value)) return value.join(", ");
      if (typeof value === "object") return JSON.stringify(value);
      return value;
  }
}

function log(ctx: SyncRunContext, message: string) {
  const timestamp = new Date().toISOString().substring(11, 19);
  ctx.logLines.push(`[${timestamp}] ${message}`);
}

async function finalizeRun(ctx: SyncRunContext, status: string, error?: string) {
  await db
    .update(syncRuns)
    .set({
      status,
      log: ctx.logLines.join("\n"),
      error: error || null,
      recordsFetched: ctx.counts.fetched,
      recordsCreated: ctx.counts.created,
      recordsUpdated: ctx.counts.updated,
      recordsSkipped: ctx.counts.skipped,
      recordsErrored: ctx.counts.errored,
      completedAt: new Date(),
    })
    .where(eq(syncRuns.id, ctx.runId));
}

async function updateSyncConfigAfterRun(configId: string, status: string) {
  await db
    .update(syncConfigurations)
    .set({
      lastSyncAt: new Date(),
      lastSyncStatus: status,
      updatedAt: new Date(),
    })
    .where(eq(syncConfigurations.id, configId));
}

async function markNeedsRepair(configId: string, message: string) {
  await db
    .update(syncConfigurations)
    .set({
      status: "needs_repair",
      statusMessage: message,
      updatedAt: new Date(),
    })
    .where(eq(syncConfigurations.id, configId));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
