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
      <TopBar title="Customers" />
      <div className="p-8">
        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        <Card
          title={`${filtered.length.toLocaleString("en-IN")} customers`}
          action={
            <input
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
              placeholder="Search name, email, city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          }
        >
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs text-slate-400">
                <tr>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">City</th>
                  <th className="pb-2 font-medium">Tags</th>
                  <th className="pb-2 font-medium">Total spend</th>
                  <th className="pb-2 font-medium">Orders</th>
                  <th className="pb-2 font-medium">Last order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-2.5">
                      <div className="font-medium text-slate-800">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.email}</div>
                    </td>
                    <td className="py-2.5 text-slate-600">{c.city}</td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 font-medium text-slate-700">
                      {inr(c.total_spend)}
                    </td>
                    <td className="py-2.5 text-slate-600">{c.order_count}</td>
                    <td className="py-2.5 text-slate-500">
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
