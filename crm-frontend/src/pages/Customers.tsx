import { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import Card from "../components/Card";
import TableSkeleton from "../components/TableSkeleton";
import { customers as customersApi } from "../api";
import type { CustomerSummary } from "../lib/types";
import { inr, relativeDays } from "../lib/format";

// Professional, muted tag palette. Each distinct tag maps deterministically to
// one swatch so the same tag always shows the same colour across rows.
const TAG_COLORS = [
  "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
  "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
  "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200",
  "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200",
  "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200",
];

function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export default function Customers() {
  const [rows, setRows] = useState<CustomerSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounced search: refetch 300ms after the user stops typing.
  useEffect(() => {
    const t = setTimeout(() => {
      customersApi
        .list()
        .then(setRows)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const filtered = search
    ? rows.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase()) ||
          c.city.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  return (
    <>
      <TopBar
        title="Customers"
        subtitle="Your full audience with derived spend and recency"
      />
      <div className="px-8 pb-8 pt-2">
        {error && (
          <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        )}
        <Card
          title={loading ? "Customers" : `${filtered.length.toLocaleString("en-IN")} customers`}
          action={
            <div className="flex items-center gap-2 rounded-full border border-hairline bg-surface-2 px-3.5 py-2 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/30">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-4 w-4 text-ink-muted"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3-3" strokeLinecap="round" />
              </svg>
              <input
                className="w-48 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
                placeholder="Search name, email, city…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          }
        >
          <div className="max-h-[68vh] overflow-y-auto">
            {loading ? (
              <TableSkeleton columns={["w-44", "w-24", "w-32", "w-20", "w-12", "w-20"]} rows={8} />
            ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-surface text-xs uppercase tracking-wide text-ink-muted">
                <tr className="border-b border-hairline">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">City</th>
                  <th className="pb-3 font-medium">Tags</th>
                  <th className="pb-3 text-right font-medium">Total spend</th>
                  <th className="pb-3 text-right font-medium">Orders</th>
                  <th className="pb-3 text-right font-medium">Last order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filtered.map((c) => (
                  <tr key={c.id} className="transition hover:bg-surface-2">
                    <td className="py-3">
                      <div className="font-medium text-ink">{c.name}</div>
                      <div className="text-xs text-ink-muted">{c.email}</div>
                    </td>
                    <td className="py-3 text-ink-soft">{c.city}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <span
                            key={t}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tagColor(t)}`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="tnum py-3 text-right font-medium text-ink">
                      {inr(c.total_spend)}
                    </td>
                    <td className="tnum py-3 text-right text-ink-soft">
                      {c.order_count}
                    </td>
                    <td className="tnum py-3 text-right text-ink-muted">
                      {relativeDays(c.last_order_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
