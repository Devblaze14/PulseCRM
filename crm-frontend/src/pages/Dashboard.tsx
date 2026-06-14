import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import Card from "../components/Card";
import ExpandableCard from "../components/ExpandableCard";
import StatTile from "../components/StatTile";
import StatusBadge from "../components/StatusBadge";
import FunnelChart from "../components/FunnelChart";
import FunnelBreakdown from "../components/FunnelBreakdown";
import DonutChart from "../components/DonutChart";
import GaugeChart from "../components/GaugeChart";
import CampaignComparisonChart from "../components/CampaignComparisonChart";
import type { CampaignMetric } from "../components/CampaignComparisonChart";
import { campaigns as campaignsApi, stats as statsApi } from "../api";
import type { Campaign, CampaignStats } from "../lib/types";
import { inr, pct, shortDate } from "../lib/format";

export default function Dashboard() {
  const [overview, setOverview] = useState<CampaignStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [comparison, setComparison] = useState<CampaignMetric[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([statsApi.overview(), campaignsApi.list()])
      .then(([o, c]) => {
        setOverview(o);
        setCampaigns(c);
        // Fetch per-campaign stats for the most recent few (cheap, AI skipped)
        // to power the comparison chart. Failures degrade to dropping that bar.
        const recent = c.slice(0, 6);
        return Promise.all(
          recent.map((camp) =>
            campaignsApi
              .stats(camp.id, false)
              .then((s) => ({
                id: camp.id,
                name: camp.name,
                conversions: s.converted,
                revenue: s.attributed_revenue,
                clickRate: s.click_rate,
              }))
              .catch(() => null),
          ),
        );
      })
      .then((metrics) => {
        if (metrics) setComparison(metrics.filter(Boolean) as CampaignMetric[]);
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

  // Delivery health: delivered vs failed out of everything we sent.
  const donutData = overview
    ? [
        {
          name: "Delivered",
          value: overview.delivered,
          color: "success" as const,
        },
        { name: "Failed", value: overview.failed, color: "danger" as const },
      ].filter((d) => d.value > 0)
    : [];

  const hasActivity = !!overview && overview.sent > 0;

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle="Your campaigns, audience and revenue at a glance"
      />
      <div className="space-y-6 px-8 pb-8 pt-2">
        {error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
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

        {/* Funnel (wide) + delivery donut + conversion gauge */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {hasActivity ? (
            <ExpandableCard
              title="Overall engagement funnel"
              className="lg:col-span-3"
              glow
              expanded={
                <>
                  <FunnelChart
                    data={funnel}
                    gradientId="funnelBarExpanded"
                    height={400}
                  />
                  <FunnelBreakdown data={funnel} />
                </>
              }
            >
              <FunnelChart data={funnel} gradientId="funnelBar" />
            </ExpandableCard>
          ) : (
            <Card title="Overall engagement funnel" className="lg:col-span-3" glow>
              <p className="py-16 text-center text-sm text-ink-muted">
                No campaign activity yet. Build one in the Campaign Builder.
              </p>
            </Card>
          )}

          {hasActivity ? (
            <ExpandableCard
              title="Delivery health"
              className="lg:col-span-1"
              expanded={
                <>
                  <DonutChart
                    data={donutData}
                    centerValue={pct(overview!.delivery_rate)}
                    centerLabel="delivered"
                    maxWidth={320}
                  />
                  <div className="mx-auto mt-6 max-w-sm divide-y divide-hairline text-sm">
                    <Row
                      dot="bg-emerald-500"
                      label="Delivered"
                      value={overview!.delivered.toLocaleString("en-IN")}
                      sub={pct(overview!.delivery_rate)}
                    />
                    <Row
                      dot="bg-rose-500"
                      label="Failed"
                      value={overview!.failed.toLocaleString("en-IN")}
                      sub={pct(100 - overview!.delivery_rate)}
                    />
                    <Row
                      label="Total sent"
                      value={overview!.sent.toLocaleString("en-IN")}
                    />
                  </div>
                </>
              }
            >
              <DonutChart
                data={donutData}
                centerValue={pct(overview!.delivery_rate)}
                centerLabel="delivered"
              />
              <div className="mt-3 flex items-center justify-center gap-4 text-xs text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {overview!.delivered.toLocaleString("en-IN")} delivered
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  {overview!.failed.toLocaleString("en-IN")} failed
                </span>
              </div>
            </ExpandableCard>
          ) : (
            <Card title="Delivery health" className="lg:col-span-1">
              <p className="py-16 text-center text-sm text-ink-muted">—</p>
            </Card>
          )}

          {hasActivity ? (
            <ExpandableCard
              title="Conversion rate"
              className="lg:col-span-1"
              expanded={
                <>
                  <GaugeChart
                    value={overview!.conversion_rate}
                    label="of delivered"
                    maxWidth={320}
                  />
                  <div className="mx-auto mt-6 max-w-sm divide-y divide-hairline text-sm">
                    <Row
                      label="Converted"
                      value={overview!.converted.toLocaleString("en-IN")}
                      sub={pct(overview!.conversion_rate)}
                    />
                    <Row
                      label="Delivered"
                      value={overview!.delivered.toLocaleString("en-IN")}
                    />
                    <Row
                      label="Attributed revenue"
                      value={inr(overview!.attributed_revenue)}
                    />
                  </div>
                </>
              }
            >
              <GaugeChart
                value={overview!.conversion_rate}
                label="of delivered"
              />
              <p className="mt-3 text-center text-xs text-ink-muted">
                {overview!.converted.toLocaleString("en-IN")} converted
              </p>
            </ExpandableCard>
          ) : (
            <Card title="Conversion rate" className="lg:col-span-1">
              <p className="py-16 text-center text-sm text-ink-muted">—</p>
            </Card>
          )}
        </div>

        {/* Campaign comparison (wide) + recent campaigns */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card title="Campaign performance" className="lg:col-span-3" glow>
            {comparison.length > 0 ? (
              <CampaignComparisonChart data={comparison} />
            ) : (
              <p className="py-16 text-center text-sm text-ink-muted">
                No campaigns to compare yet.
              </p>
            )}
          </Card>

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
              <p className="py-16 text-center text-sm text-ink-muted">
                No campaigns yet.
              </p>
            ) : (
              <ul className="-mt-1 divide-y divide-hairline">
                {campaigns.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/campaigns/${c.id}`}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-2xl px-2 py-3 transition hover:bg-surface-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {c.name}
                        </p>
                        <p className="text-xs text-ink-muted">
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

// Compact label/value row used in the expanded chart modals' detail lists.
function Row({
  label,
  value,
  sub,
  dot,
}: {
  label: string;
  value: string;
  sub?: string;
  dot?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="flex items-center gap-2 text-ink-soft">
        {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
        {label}
      </span>
      <span className="flex items-baseline gap-2">
        <span className="tnum font-semibold text-ink">{value}</span>
        {sub && <span className="text-xs text-ink-muted">{sub}</span>}
      </span>
    </div>
  );
}
