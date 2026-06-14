import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTheme } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { campaigns as campaignsApi, customers as customersApi } from "../api";
import type { Campaign, CustomerSummary } from "../lib/types";

// A single thing the global search can jump to.
type SearchResult = {
  kind: "Page" | "Campaign" | "Customer";
  label: string;
  hint?: string;
  to: string;
};

// Static destinations are always searchable, even before data loads.
const PAGES: SearchResult[] = [
  { kind: "Page", label: "Dashboard", to: "/" },
  { kind: "Page", label: "Campaigns", to: "/campaigns" },
  { kind: "Page", label: "Customers", to: "/customers" },
  { kind: "Page", label: "Chat", to: "/chat" },
];

// Page header that lives inside the floating main panel. Title on the left; a
// search pill, a primary "Create" action and a small avatar/notification cluster
// on the right — matching the clean dashboard references. All right-side chrome
// is presentational; `title` is the only required prop so no page breaks.
// `subtitle` accepts a node so pages can embed a highlighted keyword (.kw).
export default function TopBar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: ReactNode;
}) {
  const { theme, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // --- Global search ---------------------------------------------------------
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [allCustomers, setAllCustomers] = useState<CustomerSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Lazily load the searchable corpus the first time the box is focused. Failures
  // are non-fatal — page/nav results still work.
  function loadCorpus() {
    if (loaded) return;
    setLoaded(true);
    campaignsApi.list().then(setAllCampaigns).catch(() => {});
    customersApi.list().then(setAllCustomers).catch(() => {});
  }

  // Build and rank results for the current query (case-insensitive substring).
  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchResult[] = [];
    for (const p of PAGES) {
      if (p.label.toLowerCase().includes(q)) out.push(p);
    }
    for (const c of allCampaigns) {
      if (
        c.name.toLowerCase().includes(q) ||
        c.goal.toLowerCase().includes(q)
      ) {
        out.push({
          kind: "Campaign",
          label: c.name,
          hint: c.status,
          to: `/campaigns/${c.id}`,
        });
      }
    }
    for (const c of allCustomers) {
      if (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
      ) {
        out.push({
          kind: "Customer",
          label: c.name,
          hint: c.email,
          to: "/customers",
        });
      }
    }
    return out.slice(0, 12);
  }, [query, allCampaigns, allCustomers]);

  // Keep the highlighted row valid as results change.
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  function goTo(r: SearchResult) {
    navigate(r.to);
    setQuery("");
    setSearchOpen(false);
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (results[activeIdx]) goTo(results[activeIdx]);
    } else if (e.key === "Escape") {
      setSearchOpen(false);
    }
  }

  // Close the search dropdown on any outside click.
  useEffect(() => {
    if (!searchOpen) return;
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [searchOpen]);

  // Close the avatar menu on any outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const email = user?.email ?? "";
  const isGuest = !user;
  // Real users show their email initials; guests get a neutral marker.
  const initials = isGuest ? "G" : (email.slice(0, 2) || "PC").toUpperCase();

  // Signing out drops back to guest mode (login is optional) — stay in the app.
  async function handleSignOut() {
    await signOut();
    setMenuOpen(false);
  }

  return (
    <header className="flex items-center justify-between gap-4 px-8 pb-2 pt-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div ref={searchRef} className="relative hidden md:block">
          <div className="flex items-center gap-2 rounded-full border border-hairline bg-surface-2 px-4 py-2 text-sm text-ink-muted transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/30">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              className="h-4 w-4 shrink-0"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3-3" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => {
                loadCorpus();
                setSearchOpen(true);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Search anything…"
              aria-label="Search anything"
              className="w-40 bg-transparent text-ink placeholder:text-ink-muted focus:outline-none"
            />
          </div>

          {searchOpen && query.trim() && (
            <div className="surface-raised absolute right-0 top-12 z-20 w-80 origin-top-right animate-scale-in overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card-hover">
              {results.length === 0 ? (
                <p className="px-4 py-3 text-sm text-ink-muted">
                  No results for “{query.trim()}”
                </p>
              ) : (
                <ul className="max-h-80 overflow-y-auto py-1">
                  {results.map((r, i) => (
                    <li key={`${r.kind}-${r.to}-${r.label}`}>
                      <button
                        onMouseEnter={() => setActiveIdx(i)}
                        onClick={() => goTo(r)}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition ${
                          i === activeIdx ? "bg-surface-2" : ""
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">
                            {r.label}
                          </span>
                          {r.hint && (
                            <span className="block truncate text-xs text-ink-muted">
                              {r.hint}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                          {r.kind}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <Link
          to="/chat"
          className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-surface shadow-card transition hover:opacity-90 dark:bg-brand-600 dark:text-white dark:shadow-brand-glow dark:hover:bg-brand-500"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="h-4 w-4"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create
        </Link>

        <button
          onClick={toggle}
          aria-label="Toggle dark mode"
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-ink-soft transition hover:bg-surface-2 hover:text-ink"
        >
          {theme === "dark" ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[18px] w-[18px]"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[18px] w-[18px]"
            >
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </button>

        <button
          aria-label="Notifications"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-ink-soft transition hover:bg-surface-2 hover:text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[18px]"
          >
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Account menu"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
          >
            {initials}
          </button>
          {menuOpen && (
            <div className="surface-raised absolute right-0 top-12 z-20 w-56 origin-top-right animate-scale-in overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card-hover">
              {isGuest ? (
                <>
                  <div className="border-b border-hairline px-4 py-3">
                    <p className="text-xs text-ink-muted">Browsing as</p>
                    <p className="truncate text-sm font-medium text-ink">Guest</p>
                  </div>
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-brand-600 transition hover:bg-surface-2"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.7}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-[18px] w-[18px]"
                    >
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <path d="M10 17l5-5-5-5M15 12H3" />
                    </svg>
                    Sign in / Register
                  </Link>
                </>
              ) : (
                <>
                  <div className="border-b border-hairline px-4 py-3">
                    <p className="text-xs text-ink-muted">Signed in as</p>
                    <p className="truncate text-sm font-medium text-ink">
                      {email}
                    </p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-ink-soft transition hover:bg-surface-2"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.7}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-[18px] w-[18px]"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path d="M16 17l5-5-5-5M21 12H9" />
                    </svg>
                    Sign out
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
