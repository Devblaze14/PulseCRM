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
      <TopBar
        title="Dashboard"
        subtitle="Your campaigns, audience and revenue at a glance"
      />
      <div className="space-y-6 px-8 pb-8 pt-2">
        {error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">
            Couldn’t load data: {error}. Is the API running (with VPN on)?
          </div>
        )}

        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatTile
            label="Messages sent"
            value={overview ? overview.sent.toLocaleString("en-IN") : "—"}
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Funnel chart */}
          <Card title="Overall engagement funnel" className="lg:col-span-3">
            {funnel.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={funnel} barCategoryGap="28%">
                  <defs>
                    <linearGradient id="funnelBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="#f1f5f9"
                    strokeDasharray="0"
                  />
                  <XAxis
                    dataKey="stage"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#cbd5e1" }}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 8px 24px -10px rgba(16,24,40,0.18)",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="url(#funnelBar)"
                    radius={[8, 8, 8, 8]}
                    maxBarSize={56}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-16 text-center text-sm text-slate-400">
                No campaign activity yet. Build one in the Campaign Builder.
              </p>
            )}
          </Card>

          {/* Recent campaigns */}
          <Card
            title="Recent campaigns"
            className="lg:col-span-2"
            action={
              <Link
                to="/campaigns"
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                View all
              </Link>
            }
          >
            {campaigns.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">
                No campaigns yet.
              </p>
            ) : (
              <ul className="-mt-1 divide-y divide-slate-100">
                {campaigns.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/campaigns/${c.id}`}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-2xl px-2 py-3 transition hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {c.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {c.channel} · {shortDate(c.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
