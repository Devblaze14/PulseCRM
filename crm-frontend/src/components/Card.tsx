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
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && (
            <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
