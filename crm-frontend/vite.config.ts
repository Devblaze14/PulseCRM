import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standard Vite + React setup. The dev server runs on :5173 and talks to the
// CRM API at VITE_API_URL (see .env). No proxy needed — the API enables CORS.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
