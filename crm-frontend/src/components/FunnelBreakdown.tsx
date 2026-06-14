// Per-stage funnel breakdown table shown in the expanded chart modal. This is
// the "more detail" the page can't fit inline: for each stage we show the raw
// count, its share of the previous stage, its share of the original Sent, and
// how many were lost at that step — the drop-off story in numbers.
type FunnelDatum = { stage: string; value: number };

export default function FunnelBreakdown({ data }: { data: FunnelDatum[] }) {
  if (data.length === 0) return null;
  const top = data[0]?.value ?? 0;

  return (
    <div className="mt-6 border-t border-hairline pt-5">
      <h3 className="mb-3 text-sm font-semibold text-ink">Stage breakdown</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-muted">
            <tr className="border-b border-hairline">
              <th className="pb-2 font-medium">Stage</th>
              <th className="pb-2 text-right font-medium">Count</th>
              <th className="pb-2 text-right font-medium">% of previous</th>
              <th className="pb-2 text-right font-medium">% of sent</th>
              <th className="pb-2 text-right font-medium">Dropped</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {data.map((d, i) => {
              const prev = i > 0 ? data[i - 1].value : null;
              const pctPrev =
                prev && prev > 0 ? Math.round((d.value / prev) * 100) : null;
              const pctTop = top > 0 ? Math.round((d.value / top) * 100) : null;
              const lost = prev !== null ? Math.max(0, prev - d.value) : null;
              return (
                <tr key={d.stage} className="transition hover:bg-surface-2">
                  <td className="py-2.5 font-medium text-ink">{d.stage}</td>
                  <td className="tnum py-2.5 text-right text-ink-soft">
                    {d.value.toLocaleString("en-IN")}
                  </td>
                  <td className="tnum py-2.5 text-right text-ink-soft">
                    {pctPrev === null ? "—" : `${pctPrev}%`}
                  </td>
                  <td className="tnum py-2.5 text-right text-ink-soft">
                    {pctTop === null ? "—" : `${pctTop}%`}
                  </td>
                  <td className="tnum py-2.5 text-right">
                    {lost === null ? (
                      <span className="text-ink-muted">—</span>
                    ) : lost > 0 ? (
                      <span className="text-rose-500">
                        −{lost.toLocaleString("en-IN")}
                      </span>
                    ) : (
                      <span className="text-ink-muted">0</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
