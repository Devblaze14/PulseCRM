import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { useChartTheme } from "../lib/chart";

// Shared, theme-aware engagement-funnel bar chart used on the dashboard and the
// campaign detail page. Colours come from useChartTheme so it repaints in dark
// mode (recharts takes literal colour props, not Tailwind classes).
//
// Beyond raw counts, the funnel's real insight is *where people drop off*. We
// compute each stage's share of the previous stage (and how many were lost) and
// surface it in a custom tooltip + an under-bar label, so "Delivered → Opened:
// 62%, 1,240 lost" reads at a glance.
type FunnelDatum = { stage: string; value: number };

export default function FunnelChart({
  data,
  gradientId,
}: {
  data: FunnelDatum[];
  gradientId: string;
}) {
  const t = useChartTheme();

  // Stage-to-stage conversion: this stage's value over the previous stage's.
  // The first stage has no predecessor, so its rate is null (rendered blank).
  const enriched = data.map((d, i) => {
    const prev = i > 0 ? data[i - 1].value : null;
    const pctOfPrev =
      prev && prev > 0 ? Math.round((d.value / prev) * 100) : null;
    const lost = prev !== null ? Math.max(0, prev - d.value) : null;
    return { ...d, pctOfPrev, lost };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={enriched}
        barCategoryGap="28%"
        margin={{ top: 8, right: 36, bottom: 4, left: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.barFrom} />
            <stop offset="100%" stopColor={t.barTo} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="0" />
        <XAxis
          dataKey="stage"
          tick={{ fontSize: 12, fill: t.axis }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 12, fill: t.axisFaint }}
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip cursor={t.cursor} content={<FunnelTooltip />} />
        <Bar
          dataKey="value"
          fill={`url(#${gradientId})`}
          radius={[8, 8, 8, 8]}
          maxBarSize={56}
        >
          <LabelList
            dataKey="value"
            position="top"
            className="fill-ink"
            fontSize={12}
            formatter={(v: number) => v.toLocaleString("en-IN")}
          />
          {/* Stage-to-stage conversion shown INSIDE the bar (near the top), so
             it never collides with the X-axis stage labels — which is what made
             "Delivered" + "96%" mash together. Bars too short to hold the label
             get it placed just above instead (handled in PctLabel). */}
          <LabelList dataKey="pctOfPrev" content={<PctLabel />} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Per-bar conversion % label. Drawn INSIDE the bar near the top so it never
// collides with the X-axis stage labels below (the old "Delivered"+"96%" mash).
// When a bar is too short to legibly hold the text inside, we move the label to
// the RIGHT of the bar instead — clear of both the axis labels and the count
// label that sits above the bar top.
// The first stage has no predecessor (value === null) → nothing is rendered.
type PctLabelProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number | null;
};

const MIN_INSIDE_HEIGHT = 26; // px: below this the label won't fit inside cleanly

function PctLabel({ x, y, width, height, value }: PctLabelProps) {
  if (
    value == null ||
    x == null ||
    y == null ||
    width == null ||
    height == null
  ) {
    return null;
  }
  const fitsInside = height >= MIN_INSIDE_HEIGHT;
  if (fitsInside) {
    // Centered just below the bar's top edge, white for contrast on the bar.
    return (
      <text
        x={x + width / 2}
        y={y + 16}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="#ffffff"
      >
        {`${value}%`}
      </text>
    );
  }
  // Short bar: place the label to the right of the bar, vertically centered on
  // it, so it doesn't stack under the count label above the bar.
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      textAnchor="start"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
      fill="#94a3b8"
    >
      {`${value}%`}
    </text>
  );
}

function FunnelTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload as FunnelDatum & {
    pctOfPrev: number | null;
    lost: number | null;
  };
  return (
    <div className="rounded-xl border border-hairline bg-surface px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-ink">{d.stage}</p>
      <p className="mt-0.5 text-ink-soft">
        {d.value.toLocaleString("en-IN")} messages
      </p>
      {d.pctOfPrev !== null && (
        <p className="mt-1 text-ink-muted">
          <span className="font-medium text-brand-600">{d.pctOfPrev}%</span> of
          previous stage
          {d.lost && d.lost > 0 ? (
            <>
              {" · "}
              <span className="text-rose-500">
                {d.lost.toLocaleString("en-IN")} lost
              </span>
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}
