/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // A calm indigo-led palette for the light dashboard.
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
        // Warm neutral canvas behind the floating cards (matches the references).
        canvas: "#f1f1f3",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        // Soft, low-contrast elevation for floating cards.
        card: "0 1px 2px rgba(16,24,40,0.04), 0 6px 20px -8px rgba(16,24,40,0.10)",
        "card-hover":
          "0 2px 4px rgba(16,24,40,0.05), 0 12px 28px -10px rgba(16,24,40,0.16)",
      },
    },
  },
  plugins: [],
};
