import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import TopBar from "../components/TopBar";
import Card from "../components/Card";
import StatTile from "../components/StatTile";
import StatusBadge from "../components/StatusBadge";
import { campaigns as campaignsApi, stats as statsApi } from "../api";
import type { Campaign, CampaignStats } from "../lib/types";
import { inr, pct, shortDate } from "../lib/format";

export default function Dashboard() {
  const [overview, setOverview] = useState<CampaignStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([statsApi.overview(), campaignsApi.list()])
      .then(([o, c]) => {
        setOverview(o);
        setCampaigns(c);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Funnel chart data (cumulative reach across the lifecycle).
  const funnel = overview
    ? [
        { stage: "Sent", value: overview.sent },
        { stage: "Delivered", value: overview.delivered },
        { stage: "Opened", value: overview.opened },
        { stage: "Read", value: overview.read },
        { stage: "Clicked", value: overview.clicked },
        { stage: "Converted", value: overview.converted },
      ]
    : [];

  return (
    <>
      <TopBar title="Dashboard" />
      <div className="space-y-6 p-8">
        {error && (
          <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            Couldn’t load data: {error}. Is the API running (with VPN on)?
          </div>
        )}

        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatTile
            label="Messages sent"
            value={overview?.sent ?? "—"}
            accent="slate"
          />
          <StatTile
            label="Delivery rate"
            value={overview ? pct(overview.delivery_rate) : "—"}
            accent="emerald"
          />
          <StatTile
            label="Click rate"
            value={overview ? pct(overview.click_rate) : "—"}
            accent="amber"
          />
          <StatTile
            label="Conversions"
            value={overview?.converted ?? "—"}
            sub={overview ? pct(overview.conversion_rate) + " of delivered" : ""}
            accent="brand"
          />
          <StatTile
            label="Attributed revenue"
            value={overview ? inr(overview.attributed_revenue) : "—"}
            accent="emerald"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Funnel chart */}
          <Card title="Overall engagement funnel">
            {funnel.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={funnel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-slate-400">
                No campaign activity yet. Build one in the Campaign Builder.
              </p>
            )}
          </Card>

          {/* Recent campaigns */}
          <Card title="Recent campaigns">
            {campaigns.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">
                No campaigns yet.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-400">
                  <tr>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Channel</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaigns.slice(0, 6).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2.5">
                        <Link
                          to={`/campaigns/${c.id}`}
                          className="font-medium text-brand-600 hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-2.5 text-slate-600">{c.channel}</td>
                      <td className="py-2.5">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="py-2.5 text-slate-500">
                        {shortDate(c.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
