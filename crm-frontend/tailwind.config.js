/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // Body copy: Inter. Falls back to the system stack until the webfont loads.
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        // Headings, big metrics & UI labels: Geist — crisper and more "premium
        // SaaS" than Inter. Use via the `font-display` utility.
        display: [
          "Geist",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      colors: {
        // Xeno-style royal blue accent — full ramp so hover / active / glow
        // states have proper steps.
        brand: {
          50: "#eff4ff",
          100: "#dbe6fe",
          200: "#bfd3fe",
          300: "#93b4fd",
          400: "#608dfa",
          500: "#3b6ef6",
          600: "#1d4ed8",
          700: "#1e40af",
          800: "#1e3a8a",
          900: "#172554",
        },
        // Surface tokens driven by CSS variables so a single `.dark` class on
        // <html> repaints the whole app (canvas, cards, borders, text).
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        hairline: "rgb(var(--hairline) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-soft": "rgb(var(--ink-soft) / <alpha-value>)",
        "ink-muted": "rgb(var(--ink-muted) / <alpha-value>)",
        // Soft pastel bento accents (stat tiles, chart series). Each adapts per
        // theme via CSS variables — muted/translucent in dark, soft in light.
        "accent-lilac": "rgb(var(--accent-lilac) / <alpha-value>)",
        "accent-mint": "rgb(var(--accent-mint) / <alpha-value>)",
        "accent-blush": "rgb(var(--accent-blush) / <alpha-value>)",
        "accent-butter": "rgb(var(--accent-butter) / <alpha-value>)",
        "accent-sky": "rgb(var(--accent-sky) / <alpha-value>)",
        // Paired "ink" colors for text/icons sitting on each pastel tile.
        "accent-lilac-ink": "rgb(var(--accent-lilac-ink) / <alpha-value>)",
        "accent-mint-ink": "rgb(var(--accent-mint-ink) / <alpha-value>)",
        "accent-blush-ink": "rgb(var(--accent-blush-ink) / <alpha-value>)",
        "accent-butter-ink": "rgb(var(--accent-butter-ink) / <alpha-value>)",
        "accent-sky-ink": "rgb(var(--accent-sky-ink) / <alpha-value>)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        // Soft, low-contrast layered elevation for floating cards.
        card: "0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -12px rgba(16,24,40,0.12)",
        "card-hover":
          "0 2px 6px rgba(16,24,40,0.06), 0 18px 40px -16px rgba(16,24,40,0.20)",
        // Blue ambient glow for dark-theme hero cards (NeuroBank / Finstack look).
        glow: "0 0 0 1px rgba(59,110,246,0.12), 0 18px 60px -20px rgba(59,110,246,0.45)",
        // Premium CTA shadow tinted to the brand.
        "brand-glow":
          "0 6px 18px -6px rgba(29,78,216,0.5), 0 2px 4px rgba(29,78,216,0.25)",
      },
      ringColor: {
        brand: "rgb(var(--ring) / <alpha-value>)",
      },
      letterSpacing: {
        // Display headings get a hair of negative tracking for that tight,
        // premium look; big metric numbers a touch more.
        "tight-display": "-0.02em",
        "tighter-display": "-0.03em",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "translateY(-4px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "scale-in": "scale-in 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
