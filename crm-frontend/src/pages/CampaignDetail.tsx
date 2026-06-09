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
import { pct } from "../lib/format";

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
      <TopBar title={campaign?.name ?? "Campaign"} />
      <div className="space-y-6 p-8">
        <Link to="/campaigns" className="text-sm text-brand-600 hover:underline">
          ← All campaigns
        </Link>

        {error && (
          <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {campaign && (
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <StatusBadge status={campaign.status} />
            <span>{campaign.channel}</span>
            <span className="text-slate-300">•</span>
            <span className="italic">“{campaign.goal}”</span>
          </div>
        )}

        {/* AI insight */}
        {stats?.ai_summary && (
          <Card className="border-brand-100 bg-brand-50">
            <p className="text-sm text-brand-800">
              <span className="font-semibold">✨ AI insight: </span>
              {stats.ai_summary}
            </p>
          </Card>
        )}

        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
        </div>

        <Card title="Engagement funnel">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funnel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Communications table */}
        <Card title={`Communications (${comms.length})`}>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs text-slate-400">
                <tr>
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium">Message</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comms.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 font-medium text-slate-700">
                      {m.customer_name ?? `#${m.customer_id}`}
                    </td>
                    <td className="max-w-md truncate py-2.5 text-slate-500">
                      {m.rendered_message}
                    </td>
                    <td className="py-2.5">
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
