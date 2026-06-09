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
  const [goal, setGoal] = useState("");
  const [channel, setChannel] = useState<Channel>("WHATSAPP");
  const [message, setMessage] = useState("");
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
    setMessage(draft.message);
    if (!name) setName(text.slice(0, 40));
    setLoading(false);
  }

  // Re-draft when the marketer switches channel (copy differs per channel).
  async function redraft(ch: Channel) {
    setChannel(ch);
    if (!goal) return;
    const draft = await ai.draftMessage(goal, ch, `${preview?.count ?? 0} customers`);
    setMessage(draft.message);
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
      <TopBar title="Campaign Builder" />
      <div className="grid grid-cols-1 gap-6 p-8 lg:grid-cols-2">
        {/* Left: chat thread */}
        <Card title="Chat" className="flex h-[70vh] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
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
          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="Describe your audience and offer…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={loading}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </Card>

        {/* Right: proposed campaign (audience + message + launch) */}
        <div className="space-y-6">
          <Card title="Proposed audience">
            {preview ? (
              <AudiencePreview preview={preview} />
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">
                Your audience preview will appear here.
              </p>
            )}
          </Card>

          {preview && (
            <Card title="Campaign details">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Campaign name
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Win-back — lapsed 30d"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Channel
                  </label>
                  <div className="flex gap-2">
                    {CHANNELS.map((ch) => (
                      <button
                        key={ch}
                        onClick={() => redraft(ch)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                          channel === ch
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Message (use {"{name}"} for personalisation)
                  </label>
                  <textarea
                    rows={4}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                <button
                  onClick={launch}
                  disabled={launching || !name.trim() || !message}
                  className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
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
