import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTheme } from "../lib/theme";
import { useAuth } from "../lib/auth";

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
  const initials = (email.slice(0, 2) || "PC").toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
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
        <div className="hidden items-center gap-2 rounded-full border border-hairline bg-surface-2 px-4 py-2 text-sm text-ink-muted transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/30 md:flex">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-4 w-4"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" strokeLinecap="round" />
          </svg>
          <span className="w-40">Search anything…</span>
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
            <div className="absolute right-0 top-12 z-20 w-56 animate-fade-in overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card-hover">
              <div className="border-b border-hairline px-4 py-3">
                <p className="text-xs text-ink-muted">Signed in as</p>
                <p className="truncate text-sm font-medium text-ink">{email}</p>
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
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
