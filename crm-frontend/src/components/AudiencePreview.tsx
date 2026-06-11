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
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs italic text-brand-700">
          <span className="font-semibold not-italic">Why this segment: </span>
          {rationale}
        </p>
      )}

      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-brand-600">
          {preview.count.toLocaleString("en-IN")}
        </span>
        <span className="text-sm text-slate-500">customers match</span>
      </div>

      {preview.sample.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">City</th>
                <th className="px-3 py-2 font-medium">Spend</th>
                <th className="px-3 py-2 font-medium">Last order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.sample.map((c) => (
                <tr key={c.id} className="text-slate-600">
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {c.name}
                  </td>
                  <td className="px-3 py-2">{c.city}</td>
                  <td className="px-3 py-2">{inr(c.total_spend)}</td>
                  <td className="px-3 py-2">{relativeDays(c.last_order_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="bg-slate-50 px-3 py-1.5 text-[11px] text-slate-400">
            Showing up to 10 of {preview.count.toLocaleString("en-IN")}.
          </p>
        </div>
      )}
    </div>
  );
}
