// A single dashboard metric tile: a soft pastel accent chip + small label, then
// a big tabular number with an optional trend chip (▲ green / ▼ red). The pastel
// bento accents (lilac/mint/blush/butter/sky) adapt per theme via CSS variables.
export default function StatTile({
  label,
  value,
  sub,
  accent = "brand",
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "brand" | "emerald" | "amber" | "rose" | "slate";
  trend?: { dir: "up" | "down"; value: string };
}) {
  // Map the existing accent keys to the new pastel tile palette so callers
  // don't change. `chip` is the soft tinted background; `chipInk` the icon color.
  const tone: Record<string, { chip: string; chipInk: string }> = {
    brand: { chip: "bg-accent-sky", chipInk: "text-accent-sky-ink" },
    emerald: { chip: "bg-accent-mint", chipInk: "text-accent-mint-ink" },
    amber: { chip: "bg-accent-butter", chipInk: "text-accent-butter-ink" },
    rose: { chip: "bg-accent-blush", chipInk: "text-accent-blush-ink" },
    slate: { chip: "bg-accent-lilac", chipInk: "text-accent-lilac-ink" },
  };
  const t = tone[accent];

  return (
    <div className="group rounded-3xl border border-hairline bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl ${t.chip} ${t.chipInk} transition group-hover:scale-105`}
        >
          <span className="h-2 w-2 rounded-full bg-current" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {label}
        </p>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <p className="tnum text-[28px] font-semibold leading-none tracking-tight text-ink">
          {value}
        </p>
        {trend && (
          <span
            className={`mb-0.5 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
              trend.dir === "up"
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
            }`}
          >
            {trend.dir === "up" ? "↑" : "↓"} {trend.value}
          </span>
        )}
      </div>
      {sub && <p className="mt-1.5 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}
