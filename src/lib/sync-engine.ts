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
import { contactWorkspaces } from "@/db/schema/workspaces";
import { tags } from "@/db/schema/tags";
import { fieldDefinitions } from "@/db/schema/field-definitions";
import { eq, and, asc } from "drizzle-orm";
import { getConnector } from "./connectors";
import { decryptCredentials } from "./credentials-encryption";
import { addTagToContact } from "./tags";

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

// ── Backward-compat normalizer ─────────────────────────────
// Syncs saved before the target-centric redesign used a flat format:
//   { externalFieldId, externalFieldName, crmTarget, transform? }
// Normalise on read so the rest of the engine only deals with the new shape.
function normalizeEntry(raw: unknown): FieldMappingEntry {
  const e = raw as Record<string, unknown>;
  if (e.source !== undefined) return raw as FieldMappingEntry;
  return {
    crmTarget: e.crmTarget as string,
    source: {
      type: "field",
      externalFieldId: e.externalFieldId as string,
      externalFieldName: e.externalFieldName as string,
      transform: e.transform as ("none" | "to_string" | "to_number" | "to_date" | "to_boolean") | undefined,
    },
  };
}

// ── Public API ─────────────────────────────────────────────

export async function executeSyncRun(
  syncConfigurationId: string,
  triggeredBy: "manual" | "scheduled"
): Promise<{ runId: string; status: string }> {
  const [config] = await db
    .select()
    .from(syncConfigurations)
    .where(eq(syncConfigurations.id, syncConfigurationId));

  if (!config) throw new Error(`Sync configuration ${syncConfigurationId} not found`);

  const [connection] = await db
    .select()
    .from(connections)
    .where(eq(connections.id, config.connectionId));

  if (!connection) throw new Error(`Connection ${config.connectionId} not found`);

  const activeRun = await checkForActiveRun(syncConfigurationId);
  if (activeRun) return { runId: activeRun, status: "skipped_active_run" };

  const [run] = await db
    .insert(syncRuns)
    .values({ syncConfigurationId, status: "running", triggeredBy })
    .returning();

  const ctx: SyncRunContext = {
    runId: run.id,
    logLines: [],
    counts: { fetched: 0, created: 0, updated: 0, skipped: 0, errored: 0 },
  };

  try {
    const connector = getConnector(connection.connectorType as Parameters<typeof getConnector>[0]);

    const credentials = decryptCredentials(connection.credentials);

    log(ctx, "Testing connection...");
    try {
      await connector.testConnection(credentials);
      log(ctx, "Connection OK");
    } catch (err) {
      await db
        .update(connections)
        .set({ status: "error", statusMessage: errorMessage(err), updatedAt: new Date() })
        .where(eq(connections.id, connection.id));
      throw new Error(`Connection test failed: ${errorMessage(err)}`);
    }

    log(ctx, "Validating external schema...");
    const currentSchema = await connector.getSchema(credentials, config.externalResource);
    log(ctx, `Found ${currentSchema.length} external fields`);

    const schemaIssues = validateExternalSchema(config, currentSchema);
    if (schemaIssues.length > 0) {
      await markNeedsRepair(config.id, `External schema changed: ${schemaIssues.join("; ")}`);
      throw new Error(`Schema validation failed: ${schemaIssues.join("; ")}`);
    }

    log(ctx, "Validating CRM schema...");
    const crmIssues = await validateCrmSchema(config);
    if (crmIssues.length > 0) {
      await markNeedsRepair(config.id, `CRM schema changed: ${crmIssues.join("; ")}`);
      throw new Error(`CRM schema validation failed: ${crmIssues.join("; ")}`);
    }
    log(ctx, "Schema validation passed");

    log(ctx, "Fetching records...");
    const allRecords = await fetchAllRecords(connector, credentials, config.externalResource, ctx);
    ctx.counts.fetched = allRecords.length;
    log(ctx, `Fetched ${allRecords.length} records total`);

    log(ctx, "Processing records...");
    await processRecords(allRecords, config, ctx);

    const finalStatus = ctx.counts.errored > 0 ? "partial" : "success";
    log(ctx, `Complete: ${ctx.counts.created} created, ${ctx.counts.updated} updated, ${ctx.counts.skipped} skipped, ${ctx.counts.errored} errored`);

    await finalizeRun(ctx, finalStatus);
    await updateSyncConfigAfterRun(config.id, finalStatus);

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
    .where(and(eq(syncRuns.syncConfigurationId, syncConfigurationId), eq(syncRuns.status, "running")));

  if (!activeRun) return null;

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  if (activeRun.startedAt < thirtyMinutesAgo) {
    await db
      .update(syncRuns)
      .set({ status: "error", error: "Timed out (exceeded 30 minutes)", completedAt: new Date() })
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

  for (const rawEntry of mapping.mappings) {
    const entry = normalizeEntry(rawEntry);
    // Only field-type sources reference the external schema; constants are always valid
    if (entry.source.type !== "field") continue;
    if (!currentFieldIds.has(entry.source.externalFieldId)) {
      issues.push(
        `External field "${entry.source.externalFieldName}" (ID: ${entry.source.externalFieldId}) no longer exists`
      );
    }
  }

  return issues;
}

async function validateCrmSchema(config: SyncConfiguration): Promise<string[]> {
  const issues: string[] = [];
  const mapping = config.fieldMapping;
  if (!mapping?.mappings) return issues;

  // Core + special fields are always valid
  const coreFields = new Set(["_email", "_firstName", "_lastName", "_tags"]);
  const customTargets = mapping.mappings
    .map((e) => normalizeEntry(e).crmTarget)
    .filter((t) => !coreFields.has(t));

  if (customTargets.length === 0) return issues;

  const definitions = await db.select().from(fieldDefinitions).orderBy(asc(fieldDefinitions.sortOrder));
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

  const normalizedMappings = mapping.mappings.map(normalizeEntry);

  // The CRM target names this sync owns (drives the read-only badge in the UI)
  const syncedFieldsList = normalizedMappings.map((m) => m.crmTarget);

  // Get the workspace ID from the connection (for contact-workspace linking)
  const workspaceId = await getConnectionWorkspaceId(config.connectionId);

  for (let i = 0; i < records.length; i++) {
    try {
      const record = records[i];
      const mapped = applyMapping(record.fields, normalizedMappings);

      if (!mapped.email) {
        log(ctx, `Row ${i + 1}: skipped (no email)`);
        ctx.counts.skipped++;
        continue;
      }

      const email = mapped.email.toLowerCase().trim();
      const [existing] = await db.select().from(contacts).where(eq(contacts.email, email));

      let contactId: string;

      if (existing) {
        if (config.duplicateStrategy === "skip") {
          // Still ensure workspace link exists even when skipping
          if (workspaceId) {
            await db
              .insert(contactWorkspaces)
              .values({ contactId: existing.id, workspaceId, subscriptionStatus: "neutral" })
              .onConflictDoNothing();
          }
          ctx.counts.skipped++;
          continue;
        }
        const mergedFields = { ...existing.customFields, ...mapped.customFields };
        await db
          .update(contacts)
          .set({
            firstName: mapped.firstName || existing.firstName,
            lastName: mapped.lastName || existing.lastName,
            customFields: mergedFields,
            syncConfigurationId: config.id,
            syncedFields: syncedFieldsList,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, existing.id));
        contactId = existing.id;
        ctx.counts.updated++;
      } else {
        const [created] = await db
          .insert(contacts)
          .values({
            email,
            firstName: mapped.firstName,
            lastName: mapped.lastName,
            customFields: mapped.customFields,
            createdByWorkspaceId: workspaceId,
            syncConfigurationId: config.id,
            syncedFields: syncedFieldsList,
          })
          .returning({ id: contacts.id });
        contactId = created.id;
        ctx.counts.created++;
      }

      // Ensure contact is linked to the connection's workspace
      if (workspaceId) {
        await db
          .insert(contactWorkspaces)
          .values({ contactId, workspaceId, subscriptionStatus: "neutral" })
          .onConflictDoNothing();
      }

      if (mapped.tags.length > 0) {
        await applyTagsToContact(contactId, mapped.tags);
      }
    } catch (err) {
      log(ctx, `Row ${i + 1}: error — ${errorMessage(err)}`);
      ctx.counts.errored++;
    }
  }
}

async function getConnectionWorkspaceId(
  connectionId: string
): Promise<string | null> {
  const [conn] = await db
    .select({ workspaceId: connections.workspaceId })
    .from(connections)
    .where(eq(connections.id, connectionId));
  return conn?.workspaceId ?? null;
}

function applyMapping(
  fields: Record<string, unknown>,
  mappings: FieldMappingEntry[]
): {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  customFields: Record<string, unknown>;
  tags: string[];
} {
  let email: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  const customFields: Record<string, unknown> = {};
  const tags: string[] = [];

  for (const entry of mappings) {
    let value: unknown;

    if (entry.source.type === "field") {
      // Look up by external field ID first (stable), then by name (fallback)
      const rawValue =
        fields[entry.source.externalFieldId] ?? fields[entry.source.externalFieldName];
      if (rawValue === null || rawValue === undefined) continue;
      value = coerceValue(rawValue, entry.source.transform);
      if (value === null || value === undefined) continue;
    } else {
      // Constant — applied to every record regardless of its fields
      value = entry.source.value;
      if (value === null || value === undefined) continue;
    }

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
      case "_tags":
        if (Array.isArray(value)) {
          tags.push(...(value as unknown[]).map(String).filter(Boolean));
        } else if (typeof value === "string" && value) {
          tags.push(...value.split(",").map((s) => s.trim()).filter(Boolean));
        }
        break;
      default:
        customFields[entry.crmTarget] = value;
    }
  }

  return { email, firstName, lastName, customFields, tags };
}

async function applyTagsToContact(contactId: string, tagNames: string[]) {
  for (const name of tagNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    // Find or create tag by name
    let [tag] = await db.select().from(tags).where(eq(tags.name, trimmed));
    if (!tag) {
      [tag] = await db.insert(tags).values({ name: trimmed }).returning();
    }
    await addTagToContact(contactId, tag.id);
  }
}

function coerceValue(value: unknown, transform?: string): unknown {
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
    .set({ lastSyncAt: new Date(), lastSyncStatus: status, updatedAt: new Date() })
    .where(eq(syncConfigurations.id, configId));
}

async function markNeedsRepair(configId: string, message: string) {
  await db
    .update(syncConfigurations)
    .set({ status: "needs_repair", statusMessage: message, updatedAt: new Date() })
    .where(eq(syncConfigurations.id, configId));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
