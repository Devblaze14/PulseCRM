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
        className={`max-w-[82%] px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "rounded-3xl rounded-br-lg bg-slate-900 text-white"
            : "rounded-3xl rounded-bl-lg border border-slate-200/80 bg-white text-slate-700"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
