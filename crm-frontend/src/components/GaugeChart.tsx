import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";
import { useChartTheme } from "../lib/chart";

// A single-metric radial gauge for a 0–100% value (e.g. conversion rate). The
// PolarAngleAxis is pinned to a 0–100 domain so the arc length reads as the
// percentage directly. The headline number overlays the centre. Colours come
// from useChartTheme so it repaints in dark mode — same pattern as FunnelChart.
export default function GaugeChart({
  value,
  label,
}: {
  value: number; // already in 0–100 form
  label?: string;
}) {
  const t = useChartTheme();
  const clamped = Math.max(0, Math.min(100, value));
  const data = [{ name: "metric", value: clamped, fill: t.barFrom }];

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <RadialBarChart
          data={data}
          startAngle={210}
          endAngle={-30}
          innerRadius={70}
          outerRadius={92}
          barSize={16}
        >
          <defs>
            <linearGradient id="gaugeFill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={t.barFrom} />
              <stop offset="100%" stopColor={t.barTo} />
            </linearGradient>
          </defs>
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            background={{ fill: t.track }}
            dataKey="value"
            cornerRadius={10}
            fill="url(#gaugeFill)"
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tracking-tight text-ink">
          {clamped.toFixed(1)}%
        </span>
        {label && (
          <span className="mt-0.5 text-xs text-ink-muted">{label}</span>
        )}
      </div>
    </div>
  );
}
