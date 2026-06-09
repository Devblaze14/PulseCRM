// Top bar showing the current page title plus a small "AI online" hint.
export default function TopBar({ title }: { title: string }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Groq AI connected
      </div>
    </header>
  );
}
