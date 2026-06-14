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

  // Filters (applied client-side: the list is already fully loaded in memory).
  const [city, setCity] = useState("");
  const [tag, setTag] = useState("");
  const [minOrders, setMinOrders] = useState(0);
  const [minSpend, setMinSpend] = useState(0);

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

  // Distinct cities / tags present in the data, for the dropdown options.
  const cities = Array.from(new Set(rows.map((c) => c.city)))
    .filter(Boolean)
    .sort();
  const tags = Array.from(new Set(rows.flatMap((c) => c.tags)))
    .filter(Boolean)
    .sort();

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((c) => {
    if (
      q &&
      !c.name.toLowerCase().includes(q) &&
      !c.email.toLowerCase().includes(q) &&
      !c.city.toLowerCase().includes(q)
    )
      return false;
    if (city && c.city !== city) return false;
    if (tag && !c.tags.includes(tag)) return false;
    if (c.order_count < minOrders) return false;
    if (c.total_spend < minSpend) return false;
    return true;
  });

  const activeFilters =
    (city ? 1 : 0) + (tag ? 1 : 0) + (minOrders ? 1 : 0) + (minSpend ? 1 : 0);

  function clearFilters() {
    setCity("");
    setTag("");
    setMinOrders(0);
    setMinSpend(0);
  }

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
          {/* Filter bar */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <FilterSelect
              label="City"
              value={city}
              onChange={setCity}
              options={cities.map((c) => ({ value: c, label: c }))}
            />
            <FilterSelect
              label="Tag"
              value={tag}
              onChange={setTag}
              options={tags.map((t) => ({ value: t, label: t }))}
            />
            <FilterSelect
              label="Orders"
              value={String(minOrders)}
              onChange={(v) => setMinOrders(Number(v))}
              options={[
                { value: "1", label: "1+ orders" },
                { value: "2", label: "2+ orders" },
                { value: "5", label: "5+ orders" },
                { value: "10", label: "10+ orders" },
              ]}
              allLabel="Any orders"
              allValue="0"
            />
            <FilterSelect
              label="Spend"
              value={String(minSpend)}
              onChange={(v) => setMinSpend(Number(v))}
              options={[
                { value: "1000", label: "₹1k+" },
                { value: "5000", label: "₹5k+" },
                { value: "10000", label: "₹10k+" },
                { value: "50000", label: "₹50k+" },
              ]}
              allLabel="Any spend"
              allValue="0"
            />
            {activeFilters > 0 && (
              <button
                onClick={clearFilters}
                className="ml-1 rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink"
              >
                Clear filters ({activeFilters})
              </button>
            )}
          </div>

          <div className="max-h-[68vh] overflow-y-auto">
            {loading ? (
              <TableSkeleton columns={["w-44", "w-24", "w-32", "w-20", "w-12", "w-20"]} rows={8} />
            ) : filtered.length === 0 ? (
              <p className="py-16 text-center text-sm text-ink-muted">
                No customers match these filters.
                {(activeFilters > 0 || search) && (
                  <button
                    onClick={() => {
                      clearFilters();
                      setSearch("");
                    }}
                    className="ml-1 font-medium text-brand-600 hover:underline"
                  >
                    Reset
                  </button>
                )}
              </p>
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

// A small styled dropdown used in the customers filter bar. An empty value means
// "no filter" and shows `allLabel` (defaults to "All <label>"). When a value is
// selected the control is tinted to read as active.
function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  allValue = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
  /** The value representing "no filter" (e.g. "0" for numeric selects). */
  allValue?: string;
}) {
  const active = value !== allValue;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200"
          : "border-hairline bg-surface-2 text-ink-soft"
      }`}
    >
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer bg-transparent text-sm font-medium outline-none"
      >
        <option value={allValue}>
          {allLabel ?? `All ${label.toLowerCase()}`}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
