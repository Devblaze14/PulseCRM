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
            ? "rounded-3xl rounded-br-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-brand-glow"
            : "rounded-3xl rounded-bl-lg border border-hairline bg-surface-2 text-ink-soft"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
