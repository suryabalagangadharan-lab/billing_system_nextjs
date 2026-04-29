"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export default function InvoicePrint({ invoice, autoPrint = false }) {
  const ref = useRef();

  useEffect(() => {
    if (autoPrint) {
      setTimeout(() => window.print(), 300);
    }
  }, [autoPrint]);

  if (!invoice) return <div className="p-6 font-mono text-sm text-slate-400">No invoice.</div>;

  const fmt = (n) =>
    n !== undefined && n !== null
      ? "₹ " + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })
      : "—";

  const labourCharge = Number(invoice.labourCharge || 0);

  return (
    <>
      <div className="min-h-screen bg-white px-6 py-10 print:p-0 print:bg-white">
        <div className="max-w-5xl mx-auto flex items-center justify-between border-b border-slate-200 pb-4 mb-10 print:hidden">
          <span className="text-xs font-mono tracking-widest text-slate-400 uppercase">
            ops/<span className="text-slate-900 font-semibold">hub</span>
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/invoices"
              className="text-xs font-mono px-3 py-1.5 border border-slate-200 rounded-sm text-slate-500 hover:bg-slate-50 transition-colors no-underline"
            >
              ← invoices
            </Link>
            <button
              onClick={() => window.print()}
              className="text-xs font-mono px-3 py-1.5 bg-slate-900 text-white rounded-sm hover:bg-slate-700 transition-colors"
            >
              print ↗
            </button>
          </div>
        </div>

        <div
          ref={ref}
          className="max-w-[340px] mx-auto bg-white font-mono text-[11.5px] leading-snug border border-slate-200 print:border-0 print:max-w-full print:mx-0"
        >
          <div className="border-b border-dashed border-slate-300 px-5 py-5 text-center">
            <div className="text-base font-bold tracking-widest uppercase text-slate-900 mb-0.5">
              Your Shop
            </div>
            <div className="text-[10px] text-slate-400 tracking-wider">000-000-0000</div>
            <div className="text-[10px] text-slate-400 tracking-wider">yourshop@email.com</div>
          </div>

          <div className="border-b border-dashed border-slate-300 px-5 py-4 grid grid-cols-2 gap-y-3">
            <div>
              <div className="text-[9px] tracking-widest uppercase text-slate-400 mb-0.5">Invoice</div>
              <div className="font-semibold text-slate-900">{invoice.invoiceNumber}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] tracking-widest uppercase text-slate-400 mb-0.5">Date</div>
              <div className="text-slate-700">
                {new Date(invoice.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
              <div className="text-[10px] text-slate-400">
                {new Date(invoice.createdAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            <div>
              <div className="text-[9px] tracking-widest uppercase text-slate-400 mb-0.5">Customer</div>
              <div className="font-semibold text-slate-900">
                {invoice.customerName || invoice.customer?.name || "Walk-in"}
              </div>
              {invoice.customerPhone && (
                <div className="text-[10px] text-slate-400">{invoice.customerPhone}</div>
              )}
            </div>
            {invoice.billedBy?.name && (
              <div className="text-right">
                <div className="text-[9px] tracking-widest uppercase text-slate-400 mb-0.5">Billed by</div>
                <div className="text-slate-700">{invoice.billedBy.name}</div>
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-b border-dashed border-slate-300">
            <div className="grid grid-cols-[1fr_auto] text-[9px] tracking-widest uppercase text-slate-400 mb-2">
              <span>Item</span>
              <span className="text-right">Amt</span>
            </div>
            {invoice.items.map((it) => (
              <div key={it.id} className="grid grid-cols-[1fr_auto] py-1.5 border-b border-slate-100 last:border-0">
                <div>
                  <div className="text-slate-900 font-semibold truncate max-w-[180px]">
                    {it.description || it.product?.name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {it.quantity} × {fmt(it.unitPrice)}
                  </div>
                </div>
                <div className="text-right font-semibold text-slate-900 self-center">
                  {fmt(it.total)}
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-b border-dashed border-slate-300 space-y-1.5">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{fmt(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>GST</span>
              <span>{fmt(invoice.gstAmount)}</span>
            </div>
            {labourCharge > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Labour</span>
                <span>{fmt(labourCharge)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-[14px] text-slate-900 pt-2 border-t border-slate-200 mt-2">
              <span>TOTAL</span>
              <span>{fmt(invoice.totalAmount)}</span>
            </div>
          </div>

          <div className="px-5 py-5 text-center">
            <div className="text-[9px] tracking-[0.25em] uppercase text-slate-400">
              Thank you for your business
            </div>
            <div className="mt-2 text-[9px] text-slate-300 tracking-widest">·  ·  ·</div>
          </div>
        </div>

        <div className="max-w-[340px] mx-auto mt-6 flex flex-wrap gap-4 print:hidden">
          {[["⌘P", "print"], ["G+I", "invoices"], ["G+B", "billing"]].map(([k, label]) => (
            <div key={k} className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <kbd className="bg-slate-50 border border-slate-200 rounded-sm px-1.5 py-0.5 text-slate-500 text-[10px]">
                {k}
              </kbd>
              {label}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          @page { margin: 0; size: 80mm auto; }
        }
      `}</style>
    </>
  );
}
