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

  if (!invoice)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-[14px] text-slate-300">No invoice found.</p>
      </div>
    );

  const fmt = (n) =>
    "₹ " +
    Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const labourCharge = Number(invoice.labourCharge || 0);

  return (
    <>
      <div className="min-h-screen bg-slate-100 flex flex-col items-center py-10 print:bg-white print:py-0 print:block">

        {/* ── Top bar (screen only) ── */}
        <div className="w-full max-w-sm mb-6 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-[13px] font-medium text-slate-600">OpsHub</span>
            <span className="text-slate-300 mx-1">/</span>
            <Link
              href="/invoices"
              className="text-[13px] text-slate-400 hover:text-slate-600 transition-colors no-underline"
            >
              Invoices
            </Link>
          </div>
          <button
            onClick={() => window.print()}
            className="text-[13px] font-medium px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Print ↗
          </button>
        </div>

        {/* ── Receipt ── */}
        <div
          ref={ref}
          className="w-full max-w-sm bg-white shadow-sm print:shadow-none print:max-w-full"
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          {/* Store header */}
          <div className="px-6 pt-7 pb-5 text-center border-b-2 border-dashed border-slate-200">
            <p className="text-[18px] font-black tracking-widest uppercase text-slate-900 mb-0.5">
              Sri Krishna
            </p>
            <p className="text-[12px] font-bold tracking-widest uppercase text-slate-400 mb-3">
              Automobiles
            </p>
            <p className="text-[10px] text-slate-400 tracking-wider leading-5">
              +91 9047663399 · mani@gmail.com
            </p>
          </div>

          {/* Invoice meta */}
          <div className="px-6 py-4 border-b border-dashed border-slate-200">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-[9px] tracking-widest uppercase text-slate-400 mb-0.5">
                  Invoice No.
                </p>
                <p className="text-[13px] font-bold text-slate-900">{invoice.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] tracking-widest uppercase text-slate-400 mb-0.5">Date</p>
                <p className="text-[12px] text-slate-700">
                  {new Date(invoice.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <p className="text-[10px] text-slate-400">
                  {new Date(invoice.createdAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            <div className="flex justify-between items-start">
              <div>
                <p className="text-[9px] tracking-widest uppercase text-slate-400 mb-0.5">
                  Customer
                </p>
                <p className="text-[13px] font-bold text-slate-900">
                  {invoice.customerName || invoice.customer?.name || "Walk-in"}
                </p>
                {invoice.customerPhone && (
                  <p className="text-[10px] text-slate-400 mt-0.5">{invoice.customerPhone}</p>
                )}
              </div>
              {invoice.billedBy?.name && (
                <div className="text-right">
                  <p className="text-[9px] tracking-widest uppercase text-slate-400 mb-0.5">
                    Served by
                  </p>
                  <p className="text-[12px] text-slate-700">{invoice.billedBy.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Column headers */}
          <div className="px-6 pt-4 pb-2">
            <div className="flex justify-between text-[9px] tracking-widest uppercase text-slate-400 border-b border-slate-200 pb-2">
              <span>Description</span>
              <span>Amount</span>
            </div>
          </div>

          {/* Line items */}
          <div className="px-6 pb-2">
            {invoice.items.map((it) => {
              const name = it.description || it.product?.name || "Item";
              const isService = !it.productId;
              return (
                <div key={it.id} className="py-2.5 border-b border-slate-100 last:border-0">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-slate-900 leading-snug break-words">
                        {name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-[10px] text-slate-400">
                          {it.quantity} {it.quantity === 1 ? "pc" : "pcs"} × {fmt(it.unitPrice)}
                        </p>
                        {isService && (
                          <span className="text-[8px] tracking-widest uppercase text-slate-400 border border-slate-200 px-1 py-0.5">
                            Labour
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[13px] font-bold text-slate-900 shrink-0">
                      {fmt(it.total)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="px-6 py-4 mt-2 border-t-2 border-dashed border-slate-200">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Subtotal</span>
                <span>{fmt(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>GST</span>
                <span>{fmt(invoice.gstAmount)}</span>
              </div>
              {labourCharge > 0 && (
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Labour charge</span>
                  <span>{fmt(labourCharge)}</span>
                </div>
              )}
            </div>

            {/* Grand total */}
            <div className="mt-3 pt-3 border-t-2 border-slate-900 flex justify-between items-baseline">
              <span className="text-[12px] font-black tracking-widest uppercase text-slate-900">
                Total
              </span>
              <span className="text-[20px] font-black text-slate-900">
                {fmt(invoice.totalAmount)}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-6 text-center border-t border-dashed border-slate-200">
            <p className="text-[9px] tracking-[0.3em] uppercase text-slate-400">
              Thank you for your business
            </p>
            <p className="text-[9px] text-slate-200 tracking-widest mt-2">· · · · ·</p>
          </div>
        </div>

        {/* Shortcuts (screen only) */}
        <div className="w-full max-w-sm mt-5 flex gap-5 print:hidden">
          {[["⌘P", "Print"], ["G+I", "Invoices"], ["G+B", "Billing"]].map(([k, label]) => (
            <div
              key={k}
              className="flex items-center gap-2 text-[11px] text-slate-400"
              style={{ fontFamily: "monospace" }}
            >
              <kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-500 text-[10px]">
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