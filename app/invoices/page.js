import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  await requireAuth();

  const invoices = await prisma.invoice.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    include: { customer: true },
  });

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
          <Link
            href="/"
            className="text-xs font-mono px-3 py-1.5 border border-slate-200 rounded-sm text-slate-500 hover:bg-slate-50 transition-colors no-underline"
          >
            ← home
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="mb-8">
        <p className="text-xs font-mono tracking-[0.25em] text-slate-400 uppercase mb-3">
          Billing &amp; Operations
        </p>
        <h1 className="text-3xl font-light text-slate-900 tracking-tight mb-2">
          Recent invoices,{" "}
          <span className="font-semibold">ready to print.</span>
        </h1>
        <p className="text-xs font-mono text-slate-400">
          Showing last 20 · sorted by date
        </p>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] px-5 py-2 mb-px">
        {["Invoice", "Customer", "Date", "Amount", ""].map((h) => (
          <span key={h} className="text-[10px] font-mono tracking-widest uppercase text-slate-400">
            {h}
          </span>
        ))}
      </div>

      {/* Invoice grid */}
      <div
        className="flex flex-col mb-6 rounded-sm overflow-hidden"
        style={{ gap: "1px", background: "#e2e8f0", border: "1px solid #e2e8f0" }}
      >
        {invoices.length === 0 && (
          <div className="bg-white px-5 py-10 text-center text-xs font-mono text-slate-400">
            no invoices found.
          </div>
        )}

        {invoices.map((inv) => (
          <div
            key={inv.id}
            className="grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] items-center bg-white px-5 py-4 hover:bg-slate-50 transition-colors group"
          >
            {/* Invoice number + status */}
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-900">{inv.invoiceNumber}</span>
              <span
                className={`text-[9px] font-mono font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded-sm border w-fit ${
                  inv.status === "paid"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : inv.status === "pending"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-slate-50 text-slate-400 border-slate-200"
                }`}
              >
                {inv.status ?? "draft"}
              </span>
            </div>

            {/* Customer */}
            <span className="text-xs text-slate-500 font-mono">
              {inv.customer?.name ?? "—"}
            </span>

            {/* Date */}
            <span className="text-xs text-slate-400 font-mono">
              {new Date(inv.createdAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>

            {/* Amount */}
            <span className="text-sm font-semibold text-slate-900 text-right">
              ₹ {Number(inv.totalAmount).toLocaleString("en-IN")}
            </span>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Link
                href={`/invoices/${inv.id}`}
                className="text-[10px] font-mono px-3 py-1.5 bg-slate-900 text-white border border-slate-900 rounded-sm hover:bg-slate-700 transition-colors no-underline"
              >
                view
              </Link>
              <Link
                href={`/invoices/${inv.id}?print=1`}
                className="text-[10px] font-mono px-3 py-1.5 border border-slate-200 rounded-sm text-slate-500 hover:bg-slate-50 transition-colors no-underline"
              >
                print
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Shortcuts */}
      <div className="flex flex-wrap gap-5 mb-10">
        {[["G+I", "invoices"], ["↑↓", "navigate"], ["Enter", "view"], ["P", "print"], ["⌘K", "command bar"]].map(([k, label]) => (
          <div key={k} className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <kbd className="bg-slate-50 border border-slate-200 rounded-sm px-1.5 py-0.5 text-slate-500 text-[10px]">
              {k}
            </kbd>
            {label}
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-5">
        <span className="text-[10px] font-mono text-slate-300 tracking-widest uppercase">
          Phase 1 · Next.js · Prisma · MySQL
        </span>
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
