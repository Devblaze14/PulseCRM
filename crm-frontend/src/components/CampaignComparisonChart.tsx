import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "../lib/chart";
import { inr } from "../lib/format";

// One row per recent campaign, joining the campaign to its computed stats.
export interface CampaignMetric {
  id: number;
  name: string;
  conversions: number;
  revenue: number;
  clickRate: number; // 0–100
}

type MetricKey = "conversions" | "revenue" | "clickRate";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "conversions", label: "Conversions" },
  { key: "revenue", label: "Revenue" },
  { key: "clickRate", label: "Click rate" },
];

// Horizontal bar comparison of recent campaigns with a metric toggle. Bars are
// sorted by the active metric and click through to the campaign detail page.
// Theme-aware via useChartTheme so it repaints in dark mode.
export default function CampaignComparisonChart({
  data,
}: {
  data: CampaignMetric[];
}) {
  const t = useChartTheme();
  const navigate = useNavigate();
  const [metric, setMetric] = useState<MetricKey>("conversions");

  const rows = [...data].sort((a, b) => b[metric] - a[metric]);

  const fmt = (v: number) =>
    metric === "revenue"
      ? inr(v)
      : metric === "clickRate"
        ? `${v.toFixed(1)}%`
        : String(v);

  return (
    <div>
      {/* Metric toggle */}
      <div className="mb-4 inline-flex rounded-full bg-surface-2 p-0.5">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              metric === m.key
                ? "bg-surface text-ink shadow-card"
                : "text-ink-muted hover:text-ink-soft"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 44)}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
          barCategoryGap="32%"
        >
          <defs>
            <linearGradient id="compareBar" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={t.barFrom} />
              <stop offset="100%" stopColor={t.barTo} />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal={false} stroke={t.grid} strokeDasharray="0" />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: t.axisFaint }}
            axisLine={false}
            tickLine={false}
            allowDecimals={metric === "clickRate"}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 12, fill: t.axis }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(name: string) =>
              name.length > 16 ? name.slice(0, 15) + "…" : name
            }
          />
          <Tooltip
            cursor={t.cursor}
            contentStyle={t.tooltip}
            formatter={(value: number) => [fmt(value), ""]}
          />
          <Bar
            dataKey={metric}
            radius={[0, 8, 8, 0]}
            maxBarSize={28}
            cursor="pointer"
            onClick={(_, index) => navigate(`/campaigns/${rows[index].id}`)}
          >
            {rows.map((r) => (
              <Cell key={r.id} fill="url(#compareBar)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
