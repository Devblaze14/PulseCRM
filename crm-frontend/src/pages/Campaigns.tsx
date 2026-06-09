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
      <TopBar title="Campaigns" />
      <div className="p-8">
        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        <Card>
          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              No campaigns yet. Create one in the{" "}
              <Link to="/chat" className="text-brand-600 hover:underline">
                Campaign Builder
              </Link>
              .
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400">
                <tr>
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Goal</th>
                  <th className="pb-3 font-medium">Channel</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3">
                      <Link
                        to={`/campaigns/${c.id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="max-w-xs truncate py-3 text-slate-600">
                      {c.goal}
                    </td>
                    <td className="py-3 text-slate-600">{c.channel}</td>
                    <td className="py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3 text-slate-500">
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
