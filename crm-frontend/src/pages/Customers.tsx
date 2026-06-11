import { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import Card from "../components/Card";
import { customers as customersApi } from "../api";
import type { CustomerSummary } from "../lib/types";
import { inr, relativeDays } from "../lib/format";

export default function Customers() {
  const [rows, setRows] = useState<CustomerSummary[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Debounced search: refetch 300ms after the user stops typing.
  useEffect(() => {
    const t = setTimeout(() => {
      customersApi
        .list()
        .then(setRows)
        .catch((e) => setError(e.message));
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
          <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        <Card
          title={`${filtered.length.toLocaleString("en-IN")} customers`}
          action={
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/70 px-3.5 py-2 focus-within:border-brand-400 focus-within:bg-white">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-4 w-4 text-slate-400"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3-3" strokeLinecap="round" />
              </svg>
              <input
                className="w-48 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                placeholder="Search name, email, city…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          }
        >
          <div className="max-h-[68vh] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">City</th>
                  <th className="pb-3 font-medium">Tags</th>
                  <th className="pb-3 text-right font-medium">Total spend</th>
                  <th className="pb-3 text-right font-medium">Orders</th>
                  <th className="pb-3 text-right font-medium">Last order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((c) => (
                  <tr key={c.id} className="transition hover:bg-slate-50/60">
                    <td className="py-3">
                      <div className="font-medium text-slate-800">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.email}</div>
                    </td>
                    <td className="py-3 text-slate-600">{c.city}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 text-right font-medium text-slate-800">
                      {inr(c.total_spend)}
                    </td>
                    <td className="py-3 text-right text-slate-600">
                      {c.order_count}
                    </td>
                    <td className="py-3 text-right text-slate-400">
                      {relativeDays(c.last_order_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
