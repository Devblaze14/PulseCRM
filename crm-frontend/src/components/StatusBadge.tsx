import type { CampaignStatus, CommStatus } from "../lib/types";

// Coloured pill for campaign or communication status. Colours encode progress:
// neutral → blue (in flight) → green (good outcome) → red (failure).
const COLORS: Record<string, string> = {
  // Campaign
  DRAFT: "bg-slate-100 text-slate-600",
  SENDING: "bg-blue-100 text-blue-700",
  SENT: "bg-emerald-100 text-emerald-700",
  // Communication
  QUEUED: "bg-slate-100 text-slate-600",
  DELIVERED: "bg-sky-100 text-sky-700",
  OPENED: "bg-indigo-100 text-indigo-700",
  READ: "bg-violet-100 text-violet-700",
  CLICKED: "bg-amber-100 text-amber-700",
  CONVERTED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-rose-100 text-rose-700",
};

export default function StatusBadge({
  status,
}: {
  status: CampaignStatus | CommStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        COLORS[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}
