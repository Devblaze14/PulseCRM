import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useChartTheme } from "../lib/chart";

// A small theme-aware donut for two-way splits (e.g. delivered vs failed). The
// big number sits in the hole via an absolutely-positioned overlay rather than a
// recharts label, so it stays crisp and easy to style. Colours resolve from
// useChartTheme so the chart repaints in dark mode (recharts takes literal hex,
// not Tailwind classes) — same pattern as FunnelChart.
export default function DonutChart({
  data,
  centerValue,
  centerLabel,
}: {
  // Each slice: a label, a numeric value, and one of the theme colour keys.
  data: { name: string; value: number; color: "success" | "danger" | "track" }[];
  centerValue: string;
  centerLabel?: string;
}) {
  const t = useChartTheme();
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={84}
            paddingAngle={total > 0 ? 2 : 0}
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.name} fill={t[d.color]} />
            ))}
          </Pie>
          <Tooltip cursor={false} contentStyle={t.tooltip} />
        </PieChart>
      </ResponsiveContainer>
      {/* Centered headline overlaying the donut hole. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tracking-tight text-ink">
          {centerValue}
        </span>
        {centerLabel && (
          <span className="mt-0.5 text-xs text-ink-muted">{centerLabel}</span>
        )}
      </div>
    </div>
  );
}
