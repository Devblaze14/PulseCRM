import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

// Combined sign-in / sign-up screen. Google OAuth plus an email+password form
// that toggles between "log in" and "create account". Shown when the user is
// not authenticated; redirects into the app once a session exists.
export default function Login() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If a session already exists (e.g. landed here after OAuth redirect), bounce in.
  if (session) {
    navigate(from, { replace: true });
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is on, there's no session yet.
        if (!data.session) {
          setNotice("Check your inbox to confirm your email, then log in.");
          setMode("login");
        } else {
          navigate(from, { replace: true });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/login" },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas p-4">
      {/* Ambient brand glow behind the card — soft in light, vivid on the dark navy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/10 blur-3xl dark:bg-brand-500/20"
      />
      <div className="glow-hero relative w-full max-w-sm rounded-3xl border border-hairline bg-surface p-8 shadow-card-hover dark:shadow-glow">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-brand-glow">
            P
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {mode === "login"
              ? "Sign in to PulseCRM to continue"
              : "Get started with PulseCRM"}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            {notice}
          </div>
        )}

        <button
          onClick={handleGoogle}
          className="flex w-full items-center justify-center gap-2.5 rounded-full border border-hairline bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-surface-2"
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-hairline" />
          <span className="text-xs uppercase tracking-wide text-ink-muted">or</span>
          <div className="h-px flex-1 bg-hairline" />
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-xl border border-hairline bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 placeholder:text-ink-muted"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-hairline bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 placeholder:text-ink-muted"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-brand-glow transition hover:bg-brand-500 disabled:opacity-60 disabled:shadow-none"
          >
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Log in"
                : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-muted">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
              setNotice(null);
            }}
            className="font-medium text-brand-600 hover:underline"
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>

        {/* Login is optional — let anyone skip straight into the app as a guest. */}
        <div className="mt-5 border-t border-hairline pt-4">
          <button
            onClick={() => navigate(from, { replace: true })}
            className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-ink"
          >
            Continue as guest
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
