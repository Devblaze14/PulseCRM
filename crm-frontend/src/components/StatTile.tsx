// A single dashboard metric tile: big number + label + optional sub-text.
export default function StatTile({
  label,
  value,
  sub,
  accent = "brand",
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "brand" | "emerald" | "amber" | "rose" | "slate";
}) {
  const accents: Record<string, string> = {
    brand: "text-brand-600",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
    slate: "text-slate-700",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-semibold ${accents[accent]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
