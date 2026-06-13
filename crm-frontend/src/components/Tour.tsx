import { useEffect, useLayoutEffect, useState } from "react";

// A lightweight, zero-dependency product tour. It dims the app, "spotlights"
// a real element (matched by its `data-tour` attribute) and floats a small
// card beside it. Steps are intentionally minimal — just enough to orient a
// first-time user. Mounted only while open (the `?` button controls that).

type Step = {
  /** Matches `data-tour="<target>"` on a real element. Omit for a centered step. */
  target?: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    title: "Welcome to PulseCRM 👋",
    body: "A 20-second tour of the essentials. You can skip anytime.",
  },
  {
    target: "nav-builder",
    title: "Build with plain English",
    body: "Describe your audience in words — Pulse drafts the campaign for you.",
  },
  {
    target: "nav-campaigns",
    title: "Track every campaign",
    body: "See what's sent, scheduled, and how each one is performing.",
  },
  {
    target: "nav-customers",
    title: "Know your customers",
    body: "Browse and segment everyone in your CRM from one place.",
  },
  {
    target: "nav-dashboard",
    title: "Your home base",
    body: "The Dashboard rolls it all up. That's the tour — you're set!",
  },
];

const PAD = 8; // spotlight breathing room around the target

type Rect = { top: number; left: number; width: number; height: number };

export default function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = STEPS[i];
  const isFirst = i === 0;
  const isLast = i === STEPS.length - 1;

  // Measure the current target after layout, and keep it in sync as the
  // viewport changes. `getBoundingClientRect` is viewport-relative, so we
  // remeasure on scroll too (capture phase catches scrolls in any container).
  useLayoutEffect(() => {
    function measure() {
      if (!step.target) {
        setRect(null);
        return;
      }
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${step.target}"]`
      );
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step.target]);

  // Lock background scroll while the tour is open so the spotlight can't drift.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Esc to exit; arrow keys to navigate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && !isLast) setI((n) => n + 1);
      else if (e.key === "ArrowLeft" && !isFirst) setI((n) => n - 1);
      else if (e.key === "Enter") isLast ? onClose() : setI((n) => n + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFirst, isLast, onClose]);

  // Spotlight box (or full-screen-ish centered region for the intro step).
  const spot = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  // Place the card next to the spotlight, but clamp it inside the viewport so
  // it can never render off-screen (target near an edge, narrow window, etc.).
  const CARD_W = 288; // matches w-72
  const CARD_H = 220; // generous estimate; only used to keep the top in-bounds
  const GAP = 16;
  const MARGIN = 12;

  let cardStyle: React.CSSProperties;
  if (spot) {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    // Prefer right of the spotlight; flip to the left if it would overflow.
    let left = spot.left + spot.width + GAP;
    if (left + CARD_W + MARGIN > vw) left = spot.left - CARD_W - GAP;
    left = Math.max(MARGIN, Math.min(left, vw - CARD_W - MARGIN));
    // Align the card's top with the spotlight, clamped to the viewport.
    const top = Math.max(MARGIN, Math.min(spot.top, vh - CARD_H - MARGIN));
    cardStyle = { top, left };
  } else {
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Dimmer with a punched-out spotlight via a huge box-shadow. */}
      {spot ? (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-brand-400/80 transition-all duration-300 ease-out"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: "0 0 0 9999px rgba(15,23,42,0.55)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900/55" />
      )}

      {/* Click-catcher so clicking the dim area dismisses the tour. */}
      <button
        aria-label="Close tour"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />

      {/* Step card. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Product tour"
        className="surface-raised absolute w-72 animate-scale-in rounded-2xl border border-hairline bg-surface p-4 shadow-card-hover"
        style={cardStyle}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
            Step {i + 1} of {STEPS.length}
          </span>
          <button
            onClick={onClose}
            aria-label="Skip tour"
            className="rounded-lg px-1.5 text-ink-muted transition hover:bg-surface-2 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <h3 className="text-[15px] font-semibold tracking-tight text-ink">
          {step.title}
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          {step.body}
        </p>

        {/* Progress dots. */}
        <div className="mt-4 flex items-center gap-1.5">
          {STEPS.map((_, n) => (
            <span
              key={n}
              className={`h-1.5 rounded-full transition-all ${
                n === i ? "w-4 bg-brand-500" : "w-1.5 bg-hairline"
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          {isFirst ? (
            <button
              onClick={onClose}
              className="text-[13px] font-medium text-ink-muted transition hover:text-ink"
            >
              Skip
            </button>
          ) : (
            <button
              onClick={() => setI((n) => n - 1)}
              className="text-[13px] font-medium text-ink-soft transition hover:text-ink"
            >
              Back
            </button>
          )}

          <button
            onClick={() => (isLast ? onClose() : setI((n) => n + 1))}
            className="rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-3.5 py-1.5 text-[13px] font-medium text-white shadow-brand-glow transition hover:brightness-105"
          >
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
