import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import Card from "../components/Card";
import MessageBubble from "../components/MessageBubble";
import AudiencePreview from "../components/AudiencePreview";
import { ai, campaigns as campaignsApi } from "../api";
import type { Channel, SegmentFilter, SegmentPreview } from "../lib/types";

// The hero feature: a chat-first campaign builder.
// Flow: marketer types intent → AI proposes a segment (validated + previewed)
//        and a draft message → marketer edits → "Launch campaign" confirms.
type ChatTurn = { who: "user" | "assistant"; text: string };

const CHANNELS: Channel[] = ["WHATSAPP", "SMS", "EMAIL", "RCS"];

export default function Chat() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      who: "assistant",
      text: "Hi! Describe who you want to reach and what to offer — e.g. “win back customers who haven’t ordered in 30 days, 15% off”.",
    },
  ]);
  const [loading, setLoading] = useState(false);

  // The proposed campaign assembled from AI output (editable before launch).
  const [filter, setFilter] = useState<SegmentFilter | null>(null);
  const [preview, setPreview] = useState<SegmentPreview | null>(null);
  // The AI's one-line explanation of the proposed segment (may be absent).
  const [rationale, setRationale] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [channel, setChannel] = useState<Channel>("WHATSAPP");
  const [message, setMessage] = useState("");
  // The AI's alternative copy variants; the marketer picks one into `message`.
  const [variants, setVariants] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [launching, setLaunching] = useState(false);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setGoal(text);
    setTurns((t) => [...t, { who: "user", text }]);
    setLoading(true);

    // 1) Intent → validated segment + live preview (one backend round-trip).
    const res = await ai.intentToSegment(text);
    if (!res.ok || !res.filter || !res.preview) {
      setTurns((t) => [
        ...t,
        {
          who: "assistant",
          text: res.error ?? "I couldn’t turn that into a segment. Try rephrasing.",
        },
      ]);
      setLoading(false);
      return;
    }
    setFilter(res.filter);
    setPreview(res.preview);
    setRationale(res.rationale ?? null);
    setTurns((t) => [
      ...t,
      {
        who: "assistant",
        text: `Found ${res.preview!.count.toLocaleString(
          "en-IN"
        )} matching customers. I’ve drafted a message below — review and launch when ready.`,
      },
    ]);

    // 2) Draft a channel-appropriate message for this audience.
    const summary = `${res.preview.count} customers`;
    const draft = await ai.draftMessage(text, channel, summary);
    setVariants(draft.messages);
    setMessage(draft.messages[0] ?? draft.message);
    if (!name) setName(text.slice(0, 40));
    setLoading(false);
  }

  // Re-draft when the marketer switches channel (copy differs per channel).
  async function redraft(ch: Channel) {
    setChannel(ch);
    if (!goal) return;
    const draft = await ai.draftMessage(goal, ch, `${preview?.count ?? 0} customers`);
    setVariants(draft.messages);
    setMessage(draft.messages[0] ?? draft.message);
  }

  async function launch() {
    if (!filter || !message || !name.trim() || launching) return;
    setLaunching(true);
    try {
      const campaign = await campaignsApi.create({
        name: name.trim(),
        goal,
        channel,
        segment_definition: filter,
        message_template: message,
      });
      await campaignsApi.send(campaign.id);
      navigate(`/campaigns/${campaign.id}`);
    } catch (e) {
      setTurns((t) => [
        ...t,
        { who: "assistant", text: `Launch failed: ${(e as Error).message}` },
      ]);
      setLaunching(false);
    }
  }

  return (
    <>
      <TopBar
        title="Campaign Builder"
        subtitle={
          <>
            Describe your audience in <span className="kw">plain English</span> — AI
            does the rest
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 px-8 pb-8 pt-2 lg:grid-cols-2">
        {/* Left: chat thread */}
        <Card title="Chat" className="flex h-[72vh] flex-col">
          <div className="-mr-2 flex-1 space-y-3 overflow-y-auto pr-2">
            {turns.map((t, i) => (
              <MessageBubble key={i} who={t.who}>
                {t.text}
              </MessageBubble>
            ))}
            {loading && (
              <MessageBubble who="assistant">
                <span className="animate-pulse">Thinking…</span>
              </MessageBubble>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-full border border-hairline bg-surface-2 p-1.5 pl-4 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/30">
            <input
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
              placeholder="Describe your audience and offer…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={loading}
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-brand-glow transition hover:bg-brand-500 disabled:opacity-50 disabled:shadow-none"
            >
              Send
            </button>
          </div>
        </Card>

        {/* Right: proposed campaign (audience + message + launch) */}
        <div className="space-y-6">
          <Card title="Proposed audience">
            {preview ? (
              <AudiencePreview preview={preview} rationale={rationale} />
            ) : (
              <p className="py-8 text-center text-sm text-ink-muted">
                Your audience preview will appear here.
              </p>
            )}
          </Card>

          {preview && (
            <Card title="Campaign details">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                    Campaign name
                  </label>
                  <input
                    className="w-full rounded-2xl border border-hairline bg-surface-2 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Win-back — lapsed 30d"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                    Channel
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CHANNELS.map((ch) => (
                      <button
                        key={ch}
                        onClick={() => redraft(ch)}
                        className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                          channel === ch
                            ? "border-brand-600 bg-brand-600 text-white shadow-brand-glow"
                            : "border-hairline text-ink-soft hover:bg-surface-2 hover:text-ink"
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>

                {variants.length > 1 && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                      AI suggestions — pick one to edit
                    </label>
                    <div className="space-y-2">
                      {variants.map((v, i) => {
                        const selected = v === message;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setMessage(v)}
                            className={`block w-full rounded-2xl border px-4 py-2.5 text-left text-sm transition ${
                              selected
                                ? "border-brand-400 bg-brand-50 text-brand-900 ring-1 ring-brand-200 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-500/30"
                                : "border-hairline text-ink-soft hover:bg-surface-2"
                            }`}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                    Message (use {"{name}"} for personalisation)
                  </label>
                  <textarea
                    rows={4}
                    className="w-full rounded-2xl border border-hairline bg-surface-2 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                <button
                  onClick={launch}
                  disabled={launching || !name.trim() || !message}
                  className="w-full rounded-full bg-brand-600 py-3 text-sm font-semibold text-white shadow-brand-glow transition hover:bg-brand-500 disabled:opacity-50 disabled:shadow-none"
                >
                  {launching
                    ? "Launching…"
                    : `🚀 Launch to ${preview.count.toLocaleString("en-IN")} customers`}
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
