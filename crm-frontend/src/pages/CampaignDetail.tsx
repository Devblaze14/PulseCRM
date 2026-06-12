import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import Card from "../components/Card";
import StatTile from "../components/StatTile";
import StatusBadge from "../components/StatusBadge";
import FunnelChart from "../components/FunnelChart";
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
          className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted transition hover:text-ink"
        >
          ← All campaigns
        </Link>

        {error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        )}

        {campaign && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
            <StatusBadge status={campaign.status} />
            <span className="rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-soft">
              {campaign.channel}
            </span>
          </div>
        )}

        {/* AI insight */}
        {stats?.ai_summary && (
          <div className="glow-hero flex items-start gap-3 rounded-3xl border border-brand-100 bg-brand-50 p-5 dark:border-brand-500/20 dark:bg-brand-500/10 dark:shadow-glow">
            <span className="text-lg">✨</span>
            <p className="text-sm leading-relaxed text-brand-900 dark:text-brand-100">
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

        <Card title="Engagement funnel" glow>
          <FunnelChart data={funnel} gradientId="detailBar" />
        </Card>

        {/* Communications table */}
        <Card title={`Communications (${comms.length})`}>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-surface text-xs uppercase tracking-wide text-ink-muted">
                <tr className="border-b border-hairline">
                  <th className="pb-3 font-medium">Customer</th>
                  <th className="pb-3 font-medium">Message</th>
                  <th className="pb-3 text-right font-medium">Revenue</th>
                  <th className="pb-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {comms.map((m) => (
                  <tr key={m.id} className="transition hover:bg-surface-2">
                    <td className="py-3 font-medium text-ink">
                      {m.customer_name ?? `#${m.customer_id}`}
                    </td>
                    <td className="max-w-md truncate py-3 text-ink-soft">
                      {m.rendered_message}
                    </td>
                    <td className="tnum py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
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
