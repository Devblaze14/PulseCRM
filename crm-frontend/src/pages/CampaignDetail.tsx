import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
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
import { campaigns as campaignsApi } from "../api";
import type { Campaign, CampaignStats, Communication } from "../lib/types";
import { inr, pct } from "../lib/format";

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const cid = Number(id);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [comms, setComms] = useState<Communication[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Poll stats + communications so the funnel fills in live as callbacks land.
  const refresh = useCallback(async () => {
    try {
      const [c, s, m] = await Promise.all([
        campaignsApi.get(cid),
        campaignsApi.stats(cid, false), // cheap polling: skip the AI call
        campaignsApi.communications(cid),
      ]);
      setCampaign(c);
      setStats(s);
      setComms(m);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [cid]);

  useEffect(() => {
    refresh();
    // Fetch the AI summary once (separately, since it's slower).
    campaignsApi.stats(cid, true).then(setStats).catch(() => {});
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [cid, refresh]);

  const funnel = stats
    ? [
        { stage: "Sent", value: stats.sent },
        { stage: "Delivered", value: stats.delivered },
        { stage: "Opened", value: stats.opened },
        { stage: "Read", value: stats.read },
        { stage: "Clicked", value: stats.clicked },
        { stage: "Converted", value: stats.converted },
      ]
    : [];

  return (
    <>
      <TopBar title={campaign?.name ?? "Campaign"} subtitle={campaign?.goal} />
      <div className="space-y-6 px-8 pb-8 pt-2">
        <Link
          to="/campaigns"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          ← All campaigns
        </Link>

        {error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {campaign && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <StatusBadge status={campaign.status} />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {campaign.channel}
            </span>
          </div>
        )}

        {/* AI insight */}
        {stats?.ai_summary && (
          <div className="flex items-start gap-3 rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5">
            <span className="text-lg">✨</span>
            <p className="text-sm leading-relaxed text-brand-900">
              <span className="font-semibold">AI insight — </span>
              {stats.ai_summary}
            </p>
          </div>
        )}

        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatTile label="Sent" value={stats?.sent ?? "—"} accent="slate" />
          <StatTile
            label="Delivered"
            value={stats?.delivered ?? "—"}
            sub={stats ? pct(stats.delivery_rate) : ""}
            accent="emerald"
          />
          <StatTile
            label="Clicked"
            value={stats?.clicked ?? "—"}
            sub={stats ? pct(stats.click_rate) : ""}
            accent="amber"
          />
          <StatTile
            label="Converted"
            value={stats?.converted ?? "—"}
            sub={stats ? pct(stats.conversion_rate) : ""}
            accent="brand"
          />
          <StatTile
            label="Attributed revenue"
            value={stats ? inr(stats.attributed_revenue) : "—"}
            sub={
              stats
                ? `${stats.converted} order${stats.converted === 1 ? "" : "s"}`
                : ""
            }
            accent="emerald"
          />
        </div>

        <Card title="Engagement funnel">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={funnel} barCategoryGap="28%">
              <defs>
                <linearGradient id="detailBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
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
                fill="url(#detailBar)"
                radius={[8, 8, 8, 8]}
                maxBarSize={56}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Communications table */}
        <Card title={`Communications (${comms.length})`}>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100">
                  <th className="pb-3 font-medium">Customer</th>
                  <th className="pb-3 font-medium">Message</th>
                  <th className="pb-3 text-right font-medium">Revenue</th>
                  <th className="pb-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {comms.map((m) => (
                  <tr key={m.id} className="transition hover:bg-slate-50/60">
                    <td className="py-3 font-medium text-slate-700">
                      {m.customer_name ?? `#${m.customer_id}`}
                    </td>
                    <td className="max-w-md truncate py-3 text-slate-500">
                      {m.rendered_message}
                    </td>
                    <td className="py-3 text-right font-medium text-emerald-600">
                      {m.attributed_amount ? inr(m.attributed_amount) : "—"}
                    </td>
                    <td className="py-3 text-right">
                      <StatusBadge status={m.status} />
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
