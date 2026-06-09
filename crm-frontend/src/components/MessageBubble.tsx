import type { ReactNode } from "react";

// Chat bubble for the campaign builder. `who` controls alignment + colour.
export default function MessageBubble({
  who,
  children,
}: {
  who: "user" | "assistant";
  children: ReactNode;
}) {
  const isUser = who === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-brand-600 text-white"
            : "border border-slate-200 bg-white text-slate-700"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
