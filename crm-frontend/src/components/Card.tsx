import type { ReactNode } from "react";

// Generic white card container used across screens.
export default function Card({
  title,
  children,
  className = "",
  action,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={`rounded-3xl border border-slate-200/70 bg-white p-6 shadow-card ${className}`}
    >
      {(title || action) && (
        <div className="mb-5 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
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
