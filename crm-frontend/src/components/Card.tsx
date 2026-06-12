import type { ReactNode } from "react";

// Generic card container used across screens. Pass `glow` for hero cards — they
// get a stronger elevation plus a blue ambient glow in dark mode (the glow is
// neutral in light mode; see `.glow-hero` in index.css).
export default function Card({
  title,
  children,
  className = "",
  action,
  glow = false,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  glow?: boolean;
}) {
  return (
    <section
      className={`rounded-3xl border border-hairline bg-surface p-6 ${
        glow ? "glow-hero shadow-card dark:shadow-glow" : "shadow-card"
      } ${className}`}
    >
      {(title || action) && (
        <div className="mb-5 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-base font-semibold tracking-tight text-ink">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
