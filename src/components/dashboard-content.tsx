"use client";

import { useEffect, useState } from "react";
import type { DashboardStats, RecentActivityItem, CampaignStatsItem } from "@/lib/dashboard";
import { IntakeTrendChart, LifecycleChart, CountryChart } from "./dashboard-charts";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Mail,
  Phone,
  MessageSquare,
  FileText,
  Calendar,
  Activity,
} from "lucide-react";

const interactionIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  meeting: <Calendar className="h-4 w-4" />,
  note: <FileText className="h-4 w-4" />,
  form_submission: <MessageSquare className="h-4 w-4" />,
};

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function ActivityFeed({ items }: { items: RecentActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent activity.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3 text-sm">
          <div className="mt-0.5 rounded-full bg-muted p-1.5">
            {interactionIcons[item.type] || <Activity className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {item.subject || item.type}
            </p>
            <p className="text-muted-foreground text-xs">
              {item.contactName && (
                <a
                  href={`/dashboard/contacts/${item.contactId}`}
                  className="text-blue-600 hover:underline"
                >
                  {item.contactName}
                </a>
              )}
              {item.contactName && " · "}
              {new Date(item.occurredAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CampaignTable({ campaigns }: { campaigns: CampaignStatsItem[] }) {
  if (campaigns.length === 0) {
    return <p className="text-sm text-muted-foreground">No campaigns sent yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 font-medium">Campaign</th>
            <th className="pb-2 font-medium text-right">Sent</th>
            <th className="pb-2 font-medium text-right">Delivered</th>
            <th className="pb-2 font-medium text-right">Opened</th>
            <th className="pb-2 font-medium text-right">Clicked</th>
            <th className="pb-2 font-medium text-right">Bounced</th>
            <th className="pb-2 font-medium text-right">Open Rate</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => {
            const openRate =
              c.deliveredCount > 0
                ? ((c.openedCount / c.deliveredCount) * 100).toFixed(1)
                : "—";
            return (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-2 font-medium">{c.name}</td>
                <td className="py-2 text-right">{c.sentCount}</td>
                <td className="py-2 text-right">{c.deliveredCount}</td>
                <td className="py-2 text-right">{c.openedCount}</td>
                <td className="py-2 text-right">{c.clickedCount}</td>
                <td className="py-2 text-right">{c.bouncedCount}</td>
                <td className="py-2 text-right">
                  {openRate !== "—" ? `${openRate}%` : openRate}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardContent() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Overview of your PauseAI network.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg border p-6 animate-pulse">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="mt-3 h-8 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return <p className="text-sm text-muted-foreground">Failed to load dashboard data.</p>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground mt-1">
          Overview of your PauseAI network.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Total Contacts"
          value={stats.totalContacts}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="New This Month"
          value={stats.newThisMonth}
          icon={<UserPlus className="h-5 w-5" />}
        />
        <StatCard
          label="Active"
          value={stats.activeContacts}
          icon={<UserCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Dormant / Churned"
          value={stats.dormantContacts}
          icon={<UserX className="h-5 w-5" />}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">New Contacts (Last 6 Months)</h3>
          <IntakeTrendChart data={stats.intakeTrend} />
        </div>
        <div className="rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Contacts by Lifecycle Stage</h3>
          <LifecycleChart data={stats.lifecycleStages} />
        </div>
      </div>

      {/* Countries + Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Top Countries</h3>
          <CountryChart data={stats.topCountries} />
        </div>
        <div className="rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <ActivityFeed items={stats.recentActivity} />
        </div>
      </div>

      {/* Campaign performance */}
      <div className="rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Campaign Performance</h3>
        <CampaignTable campaigns={stats.campaignStats} />
      </div>
    </div>
  );
}
