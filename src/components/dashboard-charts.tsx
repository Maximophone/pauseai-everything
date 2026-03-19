"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = [
  "#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#f97316", "#6366f1", "#14b8a6",
];

type IntakeTrendProps = {
  data: { date: string; count: number }[];
};

export function IntakeTrendChart({ data }: IntakeTrendProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + "-01").toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={formatted}>
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="count" name="New contacts" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

type LifecycleChartProps = {
  data: { stage: string; count: number }[];
};

export function LifecycleChart({ data }: LifecycleChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No lifecycle stages configured.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="stage"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          label={({ name, value }) => `${name} (${value})`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

type CountryChartProps = {
  data: { country: string; count: number }[];
};

export function CountryChart({ data }: CountryChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No country data.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
        <YAxis dataKey="country" type="category" width={100} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="count" name="Contacts" fill="#16a34a" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
