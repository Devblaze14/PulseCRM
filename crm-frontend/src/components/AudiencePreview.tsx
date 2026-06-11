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
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-xs leading-relaxed text-brand-800">
          <span className="mt-px">✨</span>
          <p>
            <span className="font-semibold">Why this segment: </span>
            {rationale}
          </p>
        </div>
      )}

      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight text-slate-900">
          {preview.count.toLocaleString("en-IN")}
        </span>
        <span className="text-sm text-slate-400">customers match</span>
      </div>

      {preview.sample.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2.5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">City</th>
                <th className="px-3 py-2.5 text-right font-medium">Spend</th>
                <th className="px-3 py-2.5 text-right font-medium">Last order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {preview.sample.map((c) => (
                <tr key={c.id} className="text-slate-600">
                  <td className="px-3 py-2.5 font-medium text-slate-800">
                    {c.name}
                  </td>
                  <td className="px-3 py-2.5">{c.city}</td>
                  <td className="px-3 py-2.5 text-right">{inr(c.total_spend)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-400">
                    {relativeDays(c.last_order_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="bg-slate-50 px-3 py-2 text-[11px] text-slate-400">
            Showing up to 10 of {preview.count.toLocaleString("en-IN")}.
          </p>
        </div>
      )}
    </div>
  );
}
