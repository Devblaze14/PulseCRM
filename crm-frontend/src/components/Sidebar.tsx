import { NavLink } from "react-router-dom";

// Left navigation. NavLink gives us active-route styling for free.
const NAV = [
  { to: "/", label: "Dashboard", icon: "📊", end: true },
  { to: "/chat", label: "Campaign Builder", icon: "✨" },
  { to: "/campaigns", label: "Campaigns", icon: "📣" },
  { to: "/customers", label: "Customers", icon: "👥" },
];

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white px-4 py-6">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          ⚡
        </div>
        <span className="text-lg font-semibold text-slate-900">PulseCRM</span>
      </div>

      <nav className="space-y-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-10 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        AI-native marketing CRM. Type intent in plain English → preview audience →
        draft → launch.
      </div>
    </aside>
  );
}
