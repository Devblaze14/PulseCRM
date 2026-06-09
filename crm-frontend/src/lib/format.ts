// Small formatting helpers shared across screens.

/** Indian Rupee formatting, e.g. 12500 -> "₹12,500". */
export function inr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

/** Human date, e.g. "9 Jun 2026". Returns "—" for null. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "3 days ago" style relative recency for last_order_at. */
export function relativeDays(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

/** A percentage already in 0-100 form -> "57.0%". */
export function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}
