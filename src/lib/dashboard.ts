import { db } from "@/db";
import { contacts } from "@/db/schema/contacts";
import { contactWorkspaces } from "@/db/schema/workspaces";
import { interactions } from "@/db/schema/interactions";
import { campaigns } from "@/db/schema/campaigns";
import { emails } from "@/db/schema/emails";
import { fieldDefinitions } from "@/db/schema/field-definitions";
import { sql, desc, eq, gte, and } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────

export type DashboardStats = {
  totalContacts: number;
  newThisMonth: number;
  activeContacts: number;
  dormantContacts: number;
  lifecycleStages: { stage: string; count: number }[];
  topCountries: { country: string; count: number }[];
  intakeTrend: { date: string; count: number }[];
  recentActivity: RecentActivityItem[];
  campaignStats: CampaignStatsItem[];
};

export type RecentActivityItem = {
  id: string;
  type: string;
  subject: string | null;
  contactName: string | null;
  contactId: string | null;
  occurredAt: string;
};

export type CampaignStatsItem = {
  id: string;
  name: string;
  status: string;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  sentAt: string | null;
};

// ── Queries ────────────────────────────────────────────────

export async function getDashboardStats(
  workspaceId?: string
): Promise<DashboardStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // Helper: build a workspace-scoped contacts subquery
  const wsContactIds = workspaceId
    ? sql`SELECT contact_id FROM contact_workspaces WHERE workspace_id = ${workspaceId}`
    : null;
  const wsContactWhere = wsContactIds
    ? sql`${contacts.id} IN (${wsContactIds})`
    : undefined;

  // Run all queries in parallel
  const [
    totalResult,
    newThisMonthResult,
    lifecycleResult,
    countryResult,
    intakeTrendResult,
    recentActivityResult,
    campaignStatsResult,
  ] = await Promise.all([
    // Total contacts
    wsContactWhere
      ? db.select({ count: sql<number>`count(*)` }).from(contacts).where(wsContactWhere)
      : db.select({ count: sql<number>`count(*)` }).from(contacts),

    // New this month
    wsContactWhere
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(contacts)
          .where(and(gte(contacts.createdAt, startOfMonth), wsContactWhere))
      : db
          .select({ count: sql<number>`count(*)` })
          .from(contacts)
          .where(gte(contacts.createdAt, startOfMonth)),

    // Contacts by lifecycle stage
    getLifecycleStageBreakdown(workspaceId),

    // Top countries
    getTopCountries(workspaceId),

    // Intake trend (last 6 months, grouped by month)
    (() => {
      const base = db
        .select({
          date: sql<string>`to_char(date_trunc('month', ${contacts.createdAt}), 'YYYY-MM')`,
          count: sql<number>`count(*)`,
        })
        .from(contacts);
      const where = wsContactWhere
        ? and(gte(contacts.createdAt, sixMonthsAgo), wsContactWhere)
        : gte(contacts.createdAt, sixMonthsAgo);
      return base
        .where(where)
        .groupBy(sql`date_trunc('month', ${contacts.createdAt})`)
        .orderBy(sql`date_trunc('month', ${contacts.createdAt})`);
    })(),

    // Recent activity (last 20 interactions with contact info)
    (() => {
      const base = db
        .select({
          id: interactions.id,
          type: interactions.type,
          subject: interactions.subject,
          contactId: interactions.contactId,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          occurredAt: interactions.occurredAt,
        })
        .from(interactions)
        .leftJoin(contacts, eq(interactions.contactId, contacts.id));
      if (wsContactIds) {
        return base
          .where(sql`${interactions.contactId} IN (${wsContactIds})`)
          .orderBy(desc(interactions.occurredAt))
          .limit(20);
      }
      return base.orderBy(desc(interactions.occurredAt)).limit(20);
    })(),

    // Campaign stats (last 10 campaigns that have been sent)
    (() => {
      const base = db.select().from(campaigns);
      if (workspaceId) {
        return base
          .where(and(sql`${campaigns.status} != 'draft'`, eq(campaigns.workspaceId, workspaceId)))
          .orderBy(desc(campaigns.sentAt))
          .limit(10);
      }
      return base
        .where(sql`${campaigns.status} != 'draft'`)
        .orderBy(desc(campaigns.sentAt))
        .limit(10);
    })(),
  ]);

  const totalContacts = Number(totalResult[0].count);
  const newThisMonth = Number(newThisMonthResult[0].count);

  // Derive active/dormant from lifecycle stages
  const dormantStages = ["dormant", "churned"];
  const dormantContacts = lifecycleResult
    .filter((s) => dormantStages.includes(s.stage.toLowerCase()))
    .reduce((sum, s) => sum + s.count, 0);
  const activeContacts = totalContacts - dormantContacts;

  return {
    totalContacts,
    newThisMonth,
    activeContacts,
    dormantContacts,
    lifecycleStages: lifecycleResult,
    topCountries: countryResult,
    intakeTrend: intakeTrendResult.map((r) => ({
      date: r.date,
      count: Number(r.count),
    })),
    recentActivity: recentActivityResult.map((r) => ({
      id: r.id,
      type: r.type,
      subject: r.subject,
      contactId: r.contactId,
      contactName: [r.firstName, r.lastName].filter(Boolean).join(" ") || null,
      occurredAt: r.occurredAt.toISOString(),
    })),
    campaignStats: campaignStatsResult.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      sentCount: c.sentCount ?? 0,
      deliveredCount: c.deliveredCount ?? 0,
      openedCount: c.openedCount ?? 0,
      clickedCount: c.clickedCount ?? 0,
      bouncedCount: c.bouncedCount ?? 0,
      sentAt: c.sentAt?.toISOString() ?? null,
    })),
  };
}

/**
 * Get contact counts by lifecycle stage.
 * Lifecycle stage is stored as a custom field (select type) called "lifecycle_stage".
 */
async function getLifecycleStageBreakdown(
  workspaceId?: string
): Promise<{ stage: string; count: number }[]> {
  const [field] = await db
    .select()
    .from(fieldDefinitions)
    .where(eq(fieldDefinitions.name, "lifecycle_stage"))
    .limit(1);

  if (!field) return [];

  const wsWhere = workspaceId
    ? sql`${contacts.id} IN (SELECT contact_id FROM contact_workspaces WHERE workspace_id = ${workspaceId})`
    : undefined;

  const base = db
    .select({
      stage: sql<string>`coalesce(${contacts.customFields}->>'lifecycle_stage', 'Unknown')`,
      count: sql<number>`count(*)`,
    })
    .from(contacts);

  const result = wsWhere
    ? await base
        .where(wsWhere)
        .groupBy(sql`${contacts.customFields}->>'lifecycle_stage'`)
        .orderBy(sql`count(*) desc`)
    : await base
        .groupBy(sql`${contacts.customFields}->>'lifecycle_stage'`)
        .orderBy(sql`count(*) desc`);

  return result.map((r) => ({
    stage: r.stage || "Unknown",
    count: Number(r.count),
  }));
}

/**
 * Get top countries by contact count.
 * Country is stored as a custom field called "country".
 */
async function getTopCountries(
  workspaceId?: string
): Promise<{ country: string; count: number }[]> {
  const [field] = await db
    .select()
    .from(fieldDefinitions)
    .where(eq(fieldDefinitions.name, "country"))
    .limit(1);

  if (!field) return [];

  const countrySet = sql`${contacts.customFields}->>'country' is not null and ${contacts.customFields}->>'country' != ''`;
  const wsScope = workspaceId
    ? sql`${contacts.id} IN (SELECT contact_id FROM contact_workspaces WHERE workspace_id = ${workspaceId})`
    : undefined;

  const where = wsScope ? sql`${countrySet} AND ${wsScope}` : countrySet;

  const result = await db
    .select({
      country: sql<string>`${contacts.customFields}->>'country'`,
      count: sql<number>`count(*)`,
    })
    .from(contacts)
    .where(where)
    .groupBy(sql`${contacts.customFields}->>'country'`)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  return result.map((r) => ({
    country: r.country,
    count: Number(r.count),
  }));
}
