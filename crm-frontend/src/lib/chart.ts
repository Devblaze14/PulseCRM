import { useTheme } from "./theme";

// Theme-aware colours for the recharts funnel. Recharts takes literal colour
// props (not CSS classes), so we resolve them from the current theme here and
// share the result across the dashboard + campaign-detail charts.
export function useChartTheme() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return {
    // Tuned to the new navy / off-white surfaces (see index.css).
    grid: dark ? "#222942" : "#eceaf2",
    axis: dark ? "#727c92" : "#949bad",
    axisFaint: dark ? "#4b5563" : "#cbd5e1",
    barFrom: "#608dfa", // brand-400 — lighter top stop for a richer gradient
    barTo: "#1d4ed8", // brand-600
    // Semantic fills for the donut (delivered vs failed) and the radial gauge.
    // Hex values are lifted straight from the Tailwind tokens already in the
    // design system (emerald-500 / rose-500 / brand-500) so charts stay on-brand.
    success: "#10b981", // emerald-500 — delivered, "good"
    danger: "#f43f5e", // rose-500 — failed
    // Soft pastel-bento series palette for multi-series charts (lilac/mint/
    // blush/butter/sky) — matches the dashboard stat tiles.
    series: dark
      ? ["#b8a8ff", "#5ee0b8", "#f69ec8", "#f0d579", "#84b8ff"]
      : ["#6d4ede", "#0c8261", "#c53575", "#a17a0d", "#1e5ac8"],
    // Neutral ring/track behind the gauge + the donut's "remainder" slice.
    track: dark ? "#222942" : "#ecebf3",
    tooltip: {
      borderRadius: 14,
      border: `1px solid ${dark ? "#222942" : "#e6e6ee"}`,
      background: dark ? "#0f1320" : "#ffffff",
      color: dark ? "#edf1fa" : "#111521",
      boxShadow: dark
        ? "0 12px 36px -12px rgba(0,0,0,0.6)"
        : "0 12px 36px -14px rgba(16,24,40,0.22)",
      fontSize: 12,
    },
    cursor: { fill: dark ? "#161b2b" : "#f7f7fb" },
  };
}
