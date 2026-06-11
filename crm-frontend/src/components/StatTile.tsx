// A single dashboard metric tile: small label + big number + optional sub-text
// and an optional trend chip (▲ green / ▼ red), matching the reference cards.
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
  const dot: Record<string, string> = {
    brand: "bg-brand-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    slate: "bg-slate-400",
  };
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card transition hover:shadow-card-hover">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot[accent]}`} />
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-3xl font-semibold tracking-tight text-slate-900">
          {value}
        </p>
        {trend && (
          <span
            className={`mb-1 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
              trend.dir === "up"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-rose-50 text-rose-600"
            }`}
          >
            {trend.dir === "up" ? "↑" : "↓"} {trend.value}
          </span>
        )}
      </div>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
