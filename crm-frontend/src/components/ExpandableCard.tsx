import { useEffect, useState } from "react";
import type { ReactNode } from "react";

// A Card that expands into a focused modal when clicked anywhere on its body.
// Use it to wrap a chart: the inline `children` are the compact version shown on
// the page; `expanded` is the richer view (a taller chart + extra metrics) shown
// in the modal. Keeping both as explicit slots means the expanded view can show
// genuinely MORE — not just a scaled-up copy of the same render.
//
// Visual chrome matches Card.tsx so the two are interchangeable on a page.
export default function ExpandableCard({
  title,
  children,
  expanded,
  className = "",
  action,
  glow = false,
}: {
  title?: string;
  children: ReactNode;
  /** Richer content for the modal. Falls back to `children` if omitted. */
  expanded?: ReactNode;
  className?: string;
  action?: ReactNode;
  glow?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Lock background scroll + wire Esc-to-close while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <section
        className={`surface-raised group relative cursor-pointer rounded-3xl border border-hairline bg-surface p-6 transition hover:shadow-card-hover ${
          glow ? "glow-hero shadow-card dark:shadow-glow" : "shadow-card"
        } ${className}`}
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        aria-label={title ? `Expand ${title}` : "Expand chart"}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {(title || action) && (
          <div className="mb-5 flex items-center justify-between gap-3">
            {title && (
              <h2 className="text-base font-semibold tracking-tight text-ink">
                {title}
              </h2>
            )}
            <div className="flex items-center gap-3">
              {/* Stop clicks on the action (e.g. a link) from also expanding. */}
              {action && (
                <span onClick={(e) => e.stopPropagation()}>{action}</span>
              )}
              <ExpandIcon className="text-ink-muted opacity-0 transition group-hover:opacity-100" />
            </div>
          </div>
        )}
        {children}
      </section>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
          {/* Dimmer — click to dismiss. */}
          <button
            aria-label="Close"
            className="absolute inset-0 h-full w-full cursor-default bg-slate-900/55"
            onClick={() => setOpen(false)}
          />

          {/* Panel. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title ?? "Chart detail"}
            className="surface-raised relative z-10 max-h-[90vh] w-full max-w-4xl animate-scale-in overflow-y-auto rounded-3xl border border-hairline bg-surface p-7 shadow-card-hover"
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                {title}
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink-muted transition hover:bg-surface-2 hover:text-ink"
              >
                ✕
              </button>
            </div>
            {expanded ?? children}
          </div>
        </div>
      )}
    </>
  );
}

function ExpandIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}
