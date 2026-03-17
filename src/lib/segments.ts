import { db } from "@/db";
import { contacts } from "@/db/schema/contacts";
import { segments, type SegmentFilter, type SegmentCondition } from "@/db/schema/segments";
import { contactTags } from "@/db/schema/tags";
import { tags } from "@/db/schema/tags";
import { eq, and, or, sql, asc, desc, ilike, inArray } from "drizzle-orm";

// ─── Segment CRUD ──────────────────────────────────────────

export async function listSegments() {
  return db.select().from(segments).orderBy(asc(segments.name));
}

export async function getSegment(id: string) {
  const [segment] = await db.select().from(segments).where(eq(segments.id, id));
  return segment ?? null;
}

export async function createSegment(data: {
  name: string;
  description?: string;
  filter: SegmentFilter;
  createdBy?: string;
}) {
  const [segment] = await db.insert(segments).values(data).returning();
  return segment;
}

export async function updateSegment(
  id: string,
  data: Partial<{ name: string; description: string; filter: SegmentFilter }>
) {
  const [updated] = await db
    .update(segments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(segments.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteSegment(id: string) {
  const result = await db
    .delete(segments)
    .where(eq(segments.id, id))
    .returning({ id: segments.id });
  return result.length > 0;
}

// ─── Segment query engine ──────────────────────────────────
// Translates SegmentFilter conditions into SQL WHERE clauses

const CORE_FIELDS = ["email", "first_name", "last_name", "created_at"];

const OPERATORS = {
  // String/general
  eq: "=",
  neq: "!=",
  contains: "ILIKE",
  not_contains: "NOT ILIKE",
  starts_with: "ILIKE",
  // Numeric/date
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  // Special
  is_set: "IS NOT NULL",
  is_not_set: "IS NULL",
  in: "IN",
  has: "HAS_TAG",
  not_has: "NOT_HAS_TAG",
  after: ">",
  before: "<",
} as const;

function buildConditionSql(condition: SegmentCondition): ReturnType<typeof sql> | null {
  const { field, operator, value } = condition;

  // Tag-based conditions
  if (field === "tag" || operator === "has" || operator === "not_has") {
    if (operator === "has") {
      return sql`EXISTS (
        SELECT 1 FROM contact_tags ct
        JOIN tags t ON ct.tag_id = t.id
        WHERE ct.contact_id = contacts.id AND t.name = ${String(value)}
      )`;
    }
    if (operator === "not_has") {
      return sql`NOT EXISTS (
        SELECT 1 FROM contact_tags ct
        JOIN tags t ON ct.tag_id = t.id
        WHERE ct.contact_id = contacts.id AND t.name = ${String(value)}
      )`;
    }
  }

  // Core fields (direct columns)
  if (CORE_FIELDS.includes(field)) {
    const col = sql.raw(`contacts.${field}`);
    return buildColumnCondition(col, operator, value);
  }

  // Custom fields (JSONB)
  const jsonPath = sql`contacts.custom_fields->>${field}`;
  return buildColumnCondition(jsonPath, operator, value);
}

function buildColumnCondition(
  col: ReturnType<typeof sql>,
  operator: string,
  value: unknown
): ReturnType<typeof sql> | null {
  switch (operator) {
    case "eq":
      return sql`${col} = ${String(value)}`;
    case "neq":
      return sql`${col} != ${String(value)}`;
    case "contains":
      return sql`${col} ILIKE ${"%" + String(value) + "%"}`;
    case "not_contains":
      return sql`${col} NOT ILIKE ${"%" + String(value) + "%"}`;
    case "starts_with":
      return sql`${col} ILIKE ${String(value) + "%"}`;
    case "gt":
    case "after":
      return sql`${col} > ${String(value)}`;
    case "gte":
      return sql`${col} >= ${String(value)}`;
    case "lt":
    case "before":
      return sql`${col} < ${String(value)}`;
    case "lte":
      return sql`${col} <= ${String(value)}`;
    case "is_set":
      return sql`${col} IS NOT NULL AND ${col} != ''`;
    case "is_not_set":
      return sql`${col} IS NULL OR ${col} = ''`;
    case "in":
      if (Array.isArray(value) && value.length > 0) {
        const placeholders = value.map((v) => sql`${String(v)}`);
        return sql`${col} IN (${sql.join(placeholders, sql`, `)})`;
      }
      return null;
    default:
      return null;
  }
}

export function buildSegmentWhere(filter: SegmentFilter): ReturnType<typeof sql> | undefined {
  const clauses = filter.conditions
    .map(buildConditionSql)
    .filter((c): c is ReturnType<typeof sql> => c !== null);

  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];

  if (filter.match === "any") {
    return sql`(${sql.join(clauses, sql` OR `)})`;
  }
  return sql`(${sql.join(clauses, sql` AND `)})`;
}

// ─── Preview a segment (count + sample) ────────────────────

export async function previewSegment(filter: SegmentFilter) {
  const where = buildSegmentWhere(filter);

  const countQuery = where
    ? sql`SELECT count(*) as count FROM contacts WHERE ${where}`
    : sql`SELECT count(*) as count FROM contacts`;

  const [countResult] = await db.execute(countQuery);
  const count = Number((countResult as Record<string, unknown>).count);

  const sampleQuery = where
    ? sql`SELECT id, email, first_name, last_name FROM contacts WHERE ${where} LIMIT 10`
    : sql`SELECT id, email, first_name, last_name FROM contacts LIMIT 10`;

  const sample = await db.execute(sampleQuery);

  return { count, sample: sample as unknown as Array<{ id: string; email: string; first_name: string; last_name: string }> };
}

// ─── Get all contact IDs matching a segment ────────────────

export async function getSegmentContactIds(filter: SegmentFilter): Promise<string[]> {
  const where = buildSegmentWhere(filter);

  const query = where
    ? sql`SELECT id FROM contacts WHERE ${where}`
    : sql`SELECT id FROM contacts`;

  const rows = await db.execute(query) as unknown as Array<{ id: string }>;
  return rows.map((r) => r.id);
}
