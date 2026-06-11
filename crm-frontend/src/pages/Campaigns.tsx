import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import Card from "../components/Card";
import StatusBadge from "../components/StatusBadge";
import { campaigns as campaignsApi } from "../api";
import type { Campaign } from "../lib/types";
import { shortDate } from "../lib/format";

export default function Campaigns() {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    campaignsApi
      .list()
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <TopBar
        title="Campaigns"
        subtitle="Every campaign you’ve launched, newest first"
      />
      <div className="px-8 pb-8 pt-2">
        {error && (
          <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        <Card title={`${rows.length} campaign${rows.length === 1 ? "" : "s"}`}>
          {rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">
              No campaigns yet. Create one in the{" "}
              <Link to="/chat" className="font-medium text-brand-600 hover:underline">
                Campaign Builder
              </Link>
              .
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Goal</th>
                  <th className="pb-3 font-medium">Channel</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 text-right font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((c) => (
                  <tr key={c.id} className="transition hover:bg-slate-50/60">
                    <td className="py-3.5">
                      <Link
                        to={`/campaigns/${c.id}`}
                        className="font-medium text-slate-800 hover:text-brand-600"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="max-w-xs truncate py-3.5 text-slate-500">
                      {c.goal}
                    </td>
                    <td className="py-3.5">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {c.channel}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3.5 text-right text-slate-400">
                      {shortDate(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
