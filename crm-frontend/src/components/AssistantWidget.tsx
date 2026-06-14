import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import { ai } from "../api";
import type { ChatMessage } from "../lib/types";

// PulseAI — a floating assistant pinned to the bottom-right corner, available on
// every page. Closed it's a round brand bubble; open it's a slide-up chat panel
// that answers free-form marketer questions (grounded in live funnel stats via
// /api/ai/chat) with a few quick-action chips for common asks.

// Quick-action chips: each sends a canned prompt through the same send() path.
const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: "Funnel overview", prompt: "How are my campaigns performing overall?" },
  { label: "Who to target", prompt: "Which customers should I reach out to next?" },
  { label: "Draft a message", prompt: "Help me draft a win-back message." },
];

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm PulseAI. Ask me about your campaign performance, who to target next, or message ideas.",
};

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [loading, setLoading] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // Keep the latest turn in view as the conversation grows.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages, loading, open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");

    // History sent to the backend is everything *before* this new user turn
    // (the router caps it further). Skip the seeded greeting — it's UI-only.
    const priorHistory = messages.filter((m) => m !== GREETING);
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setLoading(true);
    try {
      const res = await ai.chat(trimmed, priorHistory);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.reply || "Sorry, I couldn't come up with a reply just now.",
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "I hit a snag reaching the server. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Closed: the floating bubble.
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open PulseAI assistant"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-2xl text-white shadow-brand-glow transition hover:scale-105 hover:brightness-110"
      >
        <span aria-hidden>✨</span>
      </button>
    );
  }

  // Open: the chat panel.
  return (
    <div className="surface-raised fixed bottom-6 right-6 z-50 flex max-h-[70vh] w-[380px] max-w-[calc(100vw-3rem)] flex-col rounded-3xl border border-hairline bg-surface shadow-card animate-scale-in">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-base text-white shadow-brand-glow">
          <span aria-hidden>✨</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold leading-tight text-ink">
            PulseAI
          </p>
          <p className="truncate text-xs text-ink-muted">Your marketing copilot</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close assistant"
          className="grid h-8 w-8 place-items-center rounded-full text-lg text-ink-muted transition hover:bg-surface-2 hover:text-ink"
        >
          ×
        </button>
      </div>

      {/* Thread */}
      <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <MessageBubble key={i} who={m.role}>
            {m.content}
          </MessageBubble>
        ))}
        {loading && (
          <MessageBubble who="assistant">
            <span className="animate-pulse">Thinking…</span>
          </MessageBubble>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 px-4 pb-2">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            onClick={() => send(a.prompt)}
            disabled={loading}
            className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="m-3 mt-1 flex items-center gap-2 rounded-full border border-hairline bg-surface-2 p-1.5 pl-4 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/30">
        <input
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          placeholder="Ask PulseAI…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
        />
        <button
          onClick={() => send(input)}
          disabled={loading}
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-brand-glow transition hover:bg-brand-500 disabled:opacity-50 disabled:shadow-none"
        >
          Send
        </button>
      </div>
    </div>
  );
}
