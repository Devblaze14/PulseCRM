import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import RequireAuth from "./components/RequireAuth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import Customers from "./pages/Customers";

// App shell: a persistent floating sidebar + a routed main panel, both sitting on
// a soft canvas with inset padding (the modern "panels float on the desktop" look).
// Each page renders its own TopBar so the title matches the route.
function AppShell() {
  return (
    <div className="flex h-screen gap-3 overflow-hidden bg-canvas p-3">
      <Sidebar />
      <main className="surface-raised flex flex-1 flex-col overflow-hidden rounded-4xl border border-hairline bg-surface shadow-card">
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/campaigns/:id" element={<CampaignDetail />} />
            <Route path="/customers" element={<Customers />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public auth screen — no app shell. */}
      <Route path="/login" element={<Login />} />
      {/* Everything else requires a session. */}
      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
