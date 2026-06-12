import type { SegmentPreview } from "../lib/types";
import { inr, relativeDays } from "../lib/format";

// Shows the live audience count + a sample table. Used in the chat builder once
// the AI proposes a segment. `rationale` is the AI's one-line explanation of the
// segment; optional, so the preview renders fine when it's absent.
export default function AudiencePreview({
  preview,
  rationale,
}: {
  preview: SegmentPreview;
  rationale?: string | null;
}) {
  return (
    <div>
      {rationale && (
        <div className="glow-hero mb-4 flex items-start gap-2 rounded-2xl border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-xs leading-relaxed text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-200">
          <span className="mt-px">✨</span>
          <p>
            <span className="font-semibold">Why this segment: </span>
            {rationale}
          </p>
        </div>
      )}

      <div className="mb-4 flex items-baseline gap-2">
        <span className="tnum text-3xl font-semibold tracking-tight text-ink">
          {preview.count.toLocaleString("en-IN")}
        </span>
        <span className="text-sm text-ink-muted">customers match</span>
      </div>

      {preview.sample.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-hairline">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">City</th>
                <th className="px-3 py-2.5 text-right font-medium">Spend</th>
                <th className="px-3 py-2.5 text-right font-medium">Last order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline text-ink-soft">
              {preview.sample.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2.5 font-medium text-ink">{c.name}</td>
                  <td className="px-3 py-2.5">{c.city}</td>
                  <td className="px-3 py-2.5 text-right">{inr(c.total_spend)}</td>
                  <td className="px-3 py-2.5 text-right text-ink-muted">
                    {relativeDays(c.last_order_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="bg-surface-2 px-3 py-2 text-[11px] text-ink-muted">
            Showing up to 10 of {preview.count.toLocaleString("en-IN")}.
          </p>
        </div>
      )}
    </div>
  );
}
