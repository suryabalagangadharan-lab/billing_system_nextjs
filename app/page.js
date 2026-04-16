"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const sections = [
  { href: "/dashboard", title: "Dashboard", shortcut: "G+D", key: "d", description: "Totals, invoices, daily activity at a glance." },
  { href: "/products", title: "Products", shortcut: "G+P", key: "p", description: "Manage catalog, pricing, and stock levels." },
  { href: "/billing", title: "Billing", shortcut: "G+B", key: "b", description: "Fast POS invoice creation with keyboard entry." },
  { href: "/service", title: "Service", shortcut: "G+S", key: "s", description: "Repair jobs, parts tracking, labour charges." },
  { href: "/reports", title: "Reports", shortcut: "G+R", key: "r", description: "Daily, monthly, yearly export-ready reports." },
  { href: "/login", title: "Login", shortcut: "G+L", key: "l", description: "Auth entry point for protected routes." },
];

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(2);
  const [time, setTime] = useState("");
  const [cmdFocused, setCmdFocused] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime([now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":"));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (cmdFocused) { if (e.key === "Escape") document.activeElement?.blur(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); document.getElementById("home-cmd")?.focus(); return; }
      if (e.key === "Tab") { e.preventDefault(); setActiveIndex((i) => (i + 1) % sections.length); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % sections.length); return; }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => (i - 1 + sections.length) % sections.length); return; }
      const idx = sections.findIndex((s) => s.key === e.key.toLowerCase());
      if (idx !== -1) setActiveIndex(idx);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cmdFocused]);

  return (
    <main className="min-h-screen bg-white px-6 py-10 max-w-5xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-10">
        <span className="text-xs font-mono tracking-widest text-slate-400 uppercase">
          ops/<span className="text-slate-900 font-semibold">hub</span>
        </span>
        <div className="flex items-center gap-5">
          <span className="text-xs font-mono text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            online
          </span>
          <span className="text-xs font-mono text-slate-400">{time}</span>
        </div>
      </div>

      {/* Hero */}
      <div className="mb-8">
        <p className="text-xs font-mono tracking-[0.25em] text-slate-400 uppercase mb-3">Billing &amp; Operations</p>
        <h1 className="text-3xl font-light text-slate-900 tracking-tight mb-2">
          Everything you need,{" "}
          <span className="font-semibold">nothing you don't.</span>
        </h1>
        <p className="text-xs font-mono text-slate-400">Use keyboard shortcuts or click to navigate.</p>
      </div>

      {/* Command bar */}
      <div className={`flex items-center gap-3 border rounded-sm px-4 py-3 mb-6 transition-colors ${cmdFocused ? "border-slate-900" : "border-slate-200"}`}>
        <span className="text-slate-300 text-base select-none font-mono">›</span>
        <input
          id="home-cmd"
          onFocus={() => setCmdFocused(true)}
          onBlur={() => setCmdFocused(false)}
          className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-300 font-mono"
          placeholder="jump to section, search products, create invoice..."
        />
        <span className="text-xs font-mono text-slate-300">⌘K</span>
      </div>

      {/* Nav grid */}
      <div
        className="grid grid-cols-1 md:grid-cols-3 rounded-sm overflow-hidden mb-6"
        style={{ gap: "1px", background: "#e2e8f0", border: "1px solid #e2e8f0" }}
      >
        {sections.map((section, i) => (
          <Link
            key={section.href}
            href={section.href}
            onClick={() => setActiveIndex(i)}
            className="relative flex flex-col gap-1 px-5 py-5 no-underline transition-colors group"
            style={{ background: activeIndex === i ? "#f8fafc" : "#ffffff" }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm font-semibold transition-colors ${activeIndex === i ? "text-slate-900" : "text-slate-600"}`}>
                {section.title}
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm border transition-all ${activeIndex === i ? "bg-slate-900 text-white border-slate-900" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                {section.shortcut}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed pr-4">{section.description}</p>
            <span className={`absolute bottom-4 right-4 text-xs transition-all ${activeIndex === i ? "text-slate-600 translate-x-0.5 -translate-y-0.5" : "text-slate-200 group-hover:text-slate-300"}`}>↗</span>
          </Link>
        ))}
      </div>

      {/* Shortcuts row */}
      <div className="flex flex-wrap gap-5 mb-10">
        {[["Tab", "cycle panels"], ["Enter", "open"], ["G + key", "jump directly"], ["⌘K", "command bar"], ["?", "all shortcuts"]].map(([k, label]) => (
          <div key={k} className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <kbd className="bg-slate-50 border border-slate-200 rounded-sm px-1.5 py-0.5 text-slate-500 text-[10px]">{k}</kbd>
            {label}
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-5">
        <span className="text-[10px] font-mono text-slate-300 tracking-widest uppercase">Phase 1 · Next.js · Prisma · MySQL</span>
        <div className="flex gap-2">
          <button className="text-xs font-mono px-3 py-1.5 border border-slate-200 rounded-sm text-slate-500 hover:bg-slate-50 transition-colors">
            settings
          </button>
          <Link
            href="/billing"
            className="text-xs font-mono px-3 py-1.5 bg-slate-900 text-white rounded-sm hover:bg-slate-700 transition-colors no-underline"
          >
            new invoice →
          </Link>
        </div>
      </div>
    </main>
  );
}