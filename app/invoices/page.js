import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

function fmt(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function isoDate(value) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }) {
  const map = {
    paid:     "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending:  "bg-amber-50 text-amber-700 border-amber-200",
    draft:    "bg-slate-50 text-slate-400 border-slate-200",
    overdue:  "bg-red-50 text-red-700 border-red-200",
  };
  const label = status ?? "draft";
  return (
    <span
      className={`text-[12px] font-medium px-2 py-0.5 rounded-full border ${
        map[label] || map.draft
      }`}
    >
      {label}
    </span>
  );
}

export default async function InvoicesPage() {
  await requireAuth();

  const invoices = await prisma.invoice.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    include: { customer: true },
  });

  const totalRevenue = invoices.reduce(
    (sum, inv) => sum + Number(inv.totalAmount || 0),
    0
  );
  const paidCount = invoices.filter((inv) => inv.status === "paid").length;
  const pendingCount = invoices.filter((inv) => inv.status === "pending").length;
  const draftCount = invoices.filter(
    (inv) => !inv.status || inv.status === "draft"
  ).length;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top bar ── */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-screen-xl mx-auto px-6 h-[52px] flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-[15px] font-medium text-slate-900">OpsHub</span>
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-[14px] font-medium text-slate-900">Invoices</span>
          </div>
          <div className="flex-1" />
          <span className="text-[13px] text-slate-400">
            {invoices.length} invoices · last 20
          </span>
          <Link
            href="/billing"
            className="text-[13px] font-medium px-3 py-1.5 bg-white border border-slate-200 text-white rounded-lg hover:bg-slate-200 transition-colors no-underline"
          >
            New invoice →
          </Link>
        </div>
      </header>

      {/* ── Page title ── */}
      <div className="max-w-screen-xl mx-auto px-6 pt-6 pb-2">
        <h1 className="text-[19px] font-medium text-slate-900">Billing register</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          Recent invoices sorted by date — view, print, or track payment status.
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="max-w-screen-xl mx-auto px-6 pt-4 pb-2">
        <div className="grid grid-cols-4 bg-white border border-slate-200 rounded-xl overflow-hidden divide-x divide-slate-100">
          {[
            {
              label: "Total billed",
              value: fmt(totalRevenue),
              sub: "Last 20 invoices",
            },
            {
              label: "Paid",
              value: paidCount,
              sub: "Collected",
              green: paidCount > 0,
            },
            {
              label: "Pending",
              value: pendingCount,
              sub: "Awaiting payment",
              warn: pendingCount > 0,
            },
            {
              label: "Drafts",
              value: draftCount,
              sub: "Not yet sent",
              blue: draftCount > 0,
            },
          ].map(({ label, value, sub, warn, blue, green }) => (
            <div
              key={label}
              className={`px-5 py-4 ${
                warn ? "bg-amber-50" : blue ? "bg-blue-50" : green ? "bg-emerald-50" : ""
              }`}
            >
              <p
                className={`text-[13px] font-medium tracking-wide uppercase mb-1 ${
                  warn
                    ? "text-amber-600"
                    : blue
                    ? "text-blue-600"
                    : green
                    ? "text-emerald-600"
                    : "text-slate-400"
                }`}
              >
                {label}
              </p>
              <p
                className={`text-[20px] font-medium ${
                  warn
                    ? "text-amber-700"
                    : blue
                    ? "text-blue-700"
                    : green
                    ? "text-emerald-700"
                    : "text-slate-900"
                }`}
              >
                {value}
              </p>
              <p
                className={`text-[12px] mt-0.5 ${
                  warn
                    ? "text-amber-500"
                    : blue
                    ? "text-blue-400"
                    : green
                    ? "text-emerald-500"
                    : "text-slate-400"
                }`}
              >
                {sub}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Invoice register ── */}
      <div className="max-w-screen-xl mx-auto px-6 pt-4 pb-8">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">

          {/* Table header */}
          <div
            className="grid items-center px-5 py-3 bg-slate-50 border-b border-slate-100"
            style={{ gridTemplateColumns: "1.6fr 1.4fr 1fr 1fr 0.8fr auto" }}
          >
            {["Invoice", "Customer", "Date", "Amount", "Status", ""].map((h) => (
              <p
                key={h}
                className="text-[12px] font-medium text-slate-400 tracking-wide uppercase"
              >
                {h}
              </p>
            ))}
          </div>

          {/* Rows */}
          {invoices.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-[14px] text-slate-300 mb-3">No invoices found.</p>
              <Link
                href="/billing"
                className="text-[13px] px-4 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors no-underline"
              >
                Create your first invoice →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="grid items-center px-5 py-4 hover:bg-slate-50 transition-colors group"
                  style={{ gridTemplateColumns: "1.6fr 1.4fr 1fr 1fr 0.8fr auto" }}
                >
                  {/* Invoice number */}
                  <div>
                    <p className="text-[14px] font-medium text-slate-900">
                      {inv.invoiceNumber}
                    </p>
                    <p className="text-[12px] text-slate-400 mt-0.5">
                      #{inv.id.slice(0, 8)}
                    </p>
                  </div>

                  {/* Customer */}
                  <div className="min-w-0 pr-4">
                    <p className="text-[14px] text-slate-900 truncate">
                      {inv.customer?.name ?? "—"}
                    </p>
                    {inv.customer?.phone && (
                      <p className="text-[12px] text-slate-400 truncate">
                        {inv.customer.phone}
                      </p>
                    )}
                  </div>

                  {/* Date */}
                  <div>
                    <p className="text-[13px] text-slate-700">
                      {isoDate(inv.createdAt)}
                    </p>
                  </div>

                  {/* Amount */}
                  <div>
                    <p className="text-[14px] font-medium text-slate-900">
                      {fmt(inv.totalAmount)}
                    </p>
                  </div>

                  {/* Status */}
                  {/* <div>
                    <StatusBadge status={inv.status} />
                  </div> */}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="text-[13px] font-medium px-3 py-1.5 bg-white border border-slate-200 text-white rounded-lg hover:bg-slate-200 transition-colors no-underline"
                    >
                      View
                    </Link>
                    <Link
                      href={`/invoices/${inv.id}?print=1`}
                      className="text-[13px] font-medium px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors no-underline"
                    >
                      Print
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}