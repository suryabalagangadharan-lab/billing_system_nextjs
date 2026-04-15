export function Panel({ className = "", children }) {
  return (
    <section
      className={`rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(148,163,184,0.18)] ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionHeading({ title, description, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default" }) {
  const toneClass =
    tone === "cyan"
      ? "from-cyan-500/12 to-sky-500/5"
      : tone === "amber"
        ? "from-amber-500/12 to-orange-500/5"
        : tone === "rose"
          ? "from-rose-500/12 to-pink-500/5"
          : "from-slate-500/10 to-slate-500/5";

  return (
    <div className={`rounded-[1.75rem] border border-slate-200 bg-gradient-to-br ${toneClass} p-5`}>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate-600">{hint}</p> : null}
    </div>
  );
}

export function AlertBanner({ title, description, tone = "warning" }) {
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <div className={`rounded-[1.5rem] border px-4 py-4 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="mt-1 text-sm opacity-80">{description}</p> : null}
    </div>
  );
}

export function LoadingCard({ lines = 3, className = "" }) {
  return (
    <div className={`animate-pulse rounded-[1.75rem] border border-slate-200 bg-white/80 p-5 ${className}`}>
      <div className="h-4 w-28 rounded-full bg-slate-200" />
      <div className="mt-4 h-8 w-32 rounded-full bg-slate-200" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className="h-3 rounded-full bg-slate-100"
            style={{ width: `${92 - index * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
}
