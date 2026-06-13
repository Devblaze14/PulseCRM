import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

// Minimal inline icons (no extra dependency) — stroke style matches the
// clean, light dashboard references.
function Icon({ path }: { path: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
    >
      {path}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  builder: (
    <>
      <path d="M5 3v4M3 5h4M6 17v4M4 19h4" />
      <path d="M13 4l2.5 6L22 12l-6.5 2L13 20l-2.5-6L4 12l6.5-2z" />
    </>
  ),
  campaigns: (
    <>
      <path d="M3 11l18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 0 1-5.8-1.6" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5M18 20a6 6 0 0 0-3-5.2" />
    </>
  ),
};

const NAV = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/chat", label: "Campaign Builder", icon: "builder" },
  { to: "/campaigns", label: "Campaigns", icon: "campaigns" },
  { to: "/customers", label: "Customers", icon: "customers" },
];

export default function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col rounded-4xl border border-hairline bg-surface px-3 py-5 shadow-card">
      <div className="mb-8 flex items-center gap-2.5 px-3">
        <img
          src="/pulse_crm_logo.png"
          alt="PulseCRM"
          className="h-9 w-9 rounded-xl object-contain p-0.5 dark:bg-white"
        />
        <span className="text-[17px] font-semibold tracking-tight text-ink">
          PulseCRM
        </span>
      </div>

      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
        Menu
      </p>
      <nav className="space-y-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-brand-glow"
                  : "text-ink-soft hover:bg-surface-2 hover:text-ink"
              }`
            }
          >
            <Icon path={ICONS[item.icon]} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="glow-hero mt-auto overflow-hidden rounded-3xl border border-brand-100 bg-brand-50 p-4 text-xs leading-relaxed text-ink-soft dark:border-brand-500/20 dark:bg-brand-500/10 dark:shadow-glow">
        <p className="mb-1 font-semibold text-brand-700 dark:text-brand-200">
          ✨ AI-native CRM
        </p>
        Describe your audience in plain English → preview → draft → launch.
      </div>
    </aside>
  );
}
