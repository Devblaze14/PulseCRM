import type { CampaignStatus, CommStatus } from "../lib/types";

// Coloured pill for campaign or communication status. Colours encode progress:
// neutral → blue (in flight) → green (good outcome) → red (failure).
const COLORS: Record<string, string> = {
  // Campaign
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  SENDING: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  SENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  // Communication
  QUEUED: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  DELIVERED: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  OPENED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  READ: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  CLICKED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  CONVERTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  FAILED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

const DOT: Record<string, string> = {
  DRAFT: "bg-slate-400",
  SENDING: "bg-blue-500",
  SENT: "bg-emerald-500",
  QUEUED: "bg-slate-400",
  DELIVERED: "bg-sky-500",
  OPENED: "bg-indigo-500",
  READ: "bg-violet-500",
  CLICKED: "bg-amber-500",
  CONVERTED: "bg-emerald-500",
  FAILED: "bg-rose-500",
};

export default function StatusBadge({
  status,
}: {
  status: CampaignStatus | CommStatus;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        COLORS[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status] ?? "bg-slate-400"}`} />
      {status}
    </span>
  );
}
