"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const sections = [
  { href: "/products", title: "Products", shortcut: "G+P", key: "p", desc: "Manage catalog, pricing, and stock levels.", color: "bg-green-50", iconColor: "#3B6D11" },
  { href: "/billing", title: "Billing", shortcut: "G+B", key: "b", desc: "Fast POS invoice creation with keyboard entry.", color: "bg-amber-50", iconColor: "#854F0B" },
  { href: "/purchases", title: "Purchases", shortcut: "G+U", key: "u", desc: "Receive stock, track supplier bills.", color: "bg-violet-50", iconColor: "#534AB7" },
  { href: "/service", title: "Service", shortcut: "G+S", key: "s", desc: "Repair jobs, parts tracking, labour charges.", color: "bg-orange-50", iconColor: "#993C1D" },
  { href: "/reports", title: "Reports", shortcut: "G+R", key: "r", desc: "Daily, monthly, yearly export-ready reports.", color: "bg-teal-50", iconColor: "#0F6E56" },
  { href: "/invoices", title: "Invoices", shortcut: "G+I", key: "i", desc: "Recent invoices, print-ready bills, and quick lookup.", color: "bg-pink-50", iconColor: "#993556" },
];

const statusBadge = {
  paid: "bg-green-50 text-green-700",
  pending: "bg-amber-50 text-amber-700",
  draft: "bg-slate-100 text-slate-500",
};

function fmt(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function fmtTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function isSameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function describeWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const time = fmtTime(date);
  if (isSameDay(date, now)) return `Today - ${time}`;
  if (isSameDay(date, yesterday)) return `Yesterday - ${time}`;

  return `${new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(date)} - ${time}`;
}

export default function HomeClient({ initialLive = null }) {
  const [activeKey, setActiveKey] = useState("p");
  const [activeNav, setActiveNav] = useState("Products");
  const [time, setTime] = useState("");
  const [cmdFocused, setCmdFocused] = useState(false);
  const [live, setLive] = useState(() =>
    initialLive
      ? { ...initialLive, loading: false, error: "" }
      : {
          loading: true,
          error: "",
          daily: null,
          monthly: null,
          product: null,
          stock: null,
        }
  );

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime([now.getHours(), now.getMinutes(), now.getSeconds()].map((part) => String(part).padStart(2, "0")).join(":"));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (cmdFocused) {
        if (e.key === "Escape") document.activeElement?.blur();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("home-cmd")?.focus();
        return;
      }

      const section = sections.find((item) => item.key === e.key.toLowerCase());
      if (section) {
        setActiveKey(section.key);
        setActiveNav(section.title);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cmdFocused]);

  useEffect(() => {
    if (initialLive) {
      return;
    }

    let active = true;

    async function load() {
      try {
        const results = await Promise.allSettled([
          fetch("/api/reports/daily").then(async (r) => ({ ok: r.ok, payload: await r.json() })),
          fetch("/api/reports/monthly").then(async (r) => ({ ok: r.ok, payload: await r.json() })),
          fetch("/api/reports/product").then(async (r) => ({ ok: r.ok, payload: await r.json() })),
          fetch("/api/reports/stock").then(async (r) => ({ ok: r.ok, payload: await r.json() })),
        ]);

        if (!active) return;

        const [daily, monthly, product, stock] = results;
        setLive({
          loading: false,
          error: "",
          daily: daily.status === "fulfilled" && daily.value.ok ? daily.value.payload : null,
          monthly: monthly.status === "fulfilled" && monthly.value.ok ? monthly.value.payload : null,
          product: product.status === "fulfilled" && product.value.ok ? product.value.payload : null,
          stock: stock.status === "fulfilled" && stock.value.ok ? stock.value.payload : null,
        });
      } catch (e) {
        if (!active) return;
        setLive((current) => ({
          ...current,
          loading: false,
          error: e?.message || "Unable to load live overview.",
        }));
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [initialLive]);

  const topProducts = useMemo(
    () =>
      [...(live.product?.products || [])]
        .sort((a, b) => Number(b.salesRevenue || 0) - Number(a.salesRevenue || 0))
        .slice(0, 5)
        .map((product) => ({
          name: product.name,
          revenue: Number(product.salesRevenue || 0),
          soldQuantity: product.soldQuantity,
          brand: product.brand || "Unbranded",
        })),
    [live.product]
  );

  const lowStockItems = useMemo(() => (live.stock?.products || []).slice(0, 6), [live.stock]);

  const recentInvoices = useMemo(() => {
    const invoices = [
      ...(live.daily?.invoices || []).map((invoice) => ({
        key: invoice.id || invoice.invoiceNumber,
        id: invoice.invoiceNumber,
        name: invoice.customerName || "Walk-in customer",
        amount: Number(invoice.totalAmount || 0),
        status: invoice.status || "",
        createdAt: invoice.createdAt,
      })),
      ...((live.monthly?.invoices || []).slice().reverse().map((invoice) => ({
        key: invoice.invoiceNumber,
        id: invoice.invoiceNumber,
        name: invoice.customerName || "Walk-in customer",
        amount: Number(invoice.finalTotal || 0),
        status: "",
        createdAt: invoice.createdDate,
      }))),
    ];

    const seen = new Set();
    return invoices.filter((invoice) => {
      if (seen.has(invoice.key)) return false;
      seen.add(invoice.key);
      return true;
    }).slice(0, 5);
  }, [live.daily, live.monthly]);

  const activityFeed = useMemo(() => {
    const entries = [];

    for (const invoice of live.daily?.invoices || []) {
      entries.push({
        key: `invoice-${invoice.id || invoice.invoiceNumber}`,
        color: "bg-green-500",
        text: `Invoice ${invoice.invoiceNumber} generated for ${fmt(invoice.totalAmount)}`,
        time: describeWhen(invoice.createdAt),
        createdAt: invoice.createdAt,
      });
    }

    for (const purchase of live.daily?.purchases || []) {
      entries.push({
        key: `purchase-${purchase.id || purchase.purchaseCode}`,
        color: "bg-blue-600",
        text: `Purchase ${purchase.purchaseCode} booked for ${fmt(purchase.totalCost)}`,
        time: describeWhen(purchase.createdAt),
        createdAt: purchase.createdAt,
      });
    }

    for (const job of live.daily?.serviceJobs || []) {
      entries.push({
        key: `service-${job.id || job.jobNumber}`,
        color: "bg-amber-600",
        text: `Service job ${job.jobNumber} opened for ${fmt(job.totalAmount)}`,
        time: describeWhen(job.createdAt),
        createdAt: job.createdAt,
      });
    }

    for (const log of live.stock?.recentLogs || []) {
      const productName = log.product?.name || "Stock item";
      const quantity = Number(log.quantity || 0);
      const movement = (log.movementType || "").toLowerCase();
      const action =
        movement === "purchase"
          ? "Stock received"
          : movement === "sale"
            ? "Stock reduced"
            : "Stock adjusted";

      entries.push({
        key: `log-${log.id}`,
        color: movement === "sale" ? "bg-blue-600" : "bg-green-500",
        text: `${action} for ${productName}${quantity ? ` (${quantity > 0 ? "+" : ""}${quantity})` : ""}${log.note ? ` - ${log.note}` : ""}`,
        time: describeWhen(log.createdAt),
        createdAt: log.createdAt,
      });
    }

    return entries
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [live.daily, live.stock]);

  const liveCards = [
    {
      label: "Daily sales",
      value: live.loading ? "-" : fmt(live.daily?.summary?.invoiceRevenue),
      sub: `${live.daily?.summary?.invoiceCount ?? 0} invoices today`,
    },
    {
      label: "Monthly sales",
      value: live.loading ? "-" : fmt(live.monthly?.summary?.totalInvoiceAmount ?? live.monthly?.summary?.invoiceRevenue),
      sub: `${live.monthly?.summary?.invoiceCount ?? 0} invoices this month`,
    },
    {
      label: "Top products",
      value: live.loading ? "-" : String(topProducts.length),
      sub: "By sales revenue",
    },
    {
      label: "Stock alerts",
      value: live.loading ? "-" : String(live.stock?.summary?.lowStockCount ?? 0),
      sub: `${live.stock?.summary?.outOfStockCount ?? 0} out of stock`,
    },
  ];

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore logout failures and continue to redirect
    }

    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-6">
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-blue-600" />
            <span className="text-base font-semibold tracking-tight text-slate-950">OpsHub</span>
            <div className="h-4 w-px bg-slate-200" />
            <span className="text-sm text-slate-500">Billing & Operations</span>
          </div>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {sections.map((section) => (
              <Link
                key={section.key}
                href={section.href}
                onClick={() => {
                  setActiveKey(section.key);
                  setActiveNav(section.title);
                }}
                className={`whitespace-nowrap rounded-md px-4 py-2 text-sm no-underline transition-colors ${
                  activeNav === section.title
                    ? "bg-slate-100 font-semibold text-slate-950"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {section.title}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-500">
              {time}
            </span>
            <div className="flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Online
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-7 px-6 py-8">
        <section>
          <div className="mb-3 flex items-end justify-between">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Live overview
            </p>
            {live.error ? <span className="text-sm text-amber-600">{live.error}</span> : null}
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {liveCards.map((card) => (
              <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="mb-2 text-sm text-slate-500">{card.label}</p>
                <p className="mb-2 text-3xl font-semibold leading-none text-slate-950">{card.value}</p>
                <p className="text-sm text-slate-500">{card.sub}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Modules
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <Link
                key={section.key}
                href={section.href}
                onClick={() => {
                  setActiveKey(section.key);
                  setActiveNav(section.title);
                }}
                className={`group flex items-start gap-3.5 rounded-xl border bg-white p-5 no-underline transition-colors ${
                  activeKey === section.key
                    ? "border-blue-400 shadow-sm"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${section.color}`}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="2" y="2" width="5" height="5" rx="1" fill={section.iconColor} />
                    <rect x="9" y="2" width="5" height="5" rx="1" fill={section.iconColor} />
                    <rect x="2" y="9" width="5" height="5" rx="1" fill={section.iconColor} />
                    <rect x="9" y="9" width="5" height="5" rx="1" fill={section.iconColor} opacity="0.4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="mb-1 text-base font-semibold text-slate-950">{section.title}</p>
                  <p className="text-sm leading-relaxed text-slate-500">{section.desc}</p>
                  <span className="mt-2 inline-block rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-500">
                    {section.shortcut}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-semibold text-slate-950">Recent invoices</p>
              <Link href="/invoices" className="text-sm text-blue-600 no-underline hover:text-blue-700">
                View all -&gt;
              </Link>
            </div>
            {recentInvoices.map((invoice) => (
              <div key={invoice.key} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
                <div className="w-20 shrink-0">
                  <span className="block font-mono text-sm text-slate-400">{invoice.id}</span>
                  <span className="block font-mono text-[10px] text-slate-300">{describeWhen(invoice.createdAt)}</span>
                </div>
                <span className="flex-1 truncate text-sm text-slate-800">{invoice.name}</span>
                <span className="mr-1 text-sm font-semibold text-slate-800">{fmt(invoice.amount)}</span>
                {invoice.status ? (
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusBadge[invoice.status]}`}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                    Posted
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-semibold text-slate-950">Activity feed</p>
              <button className="text-sm text-slate-400 transition-colors hover:text-slate-600">
                Clear all
              </button>
            </div>
            {activityFeed.map((item) => (
              <div key={item.key} className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0">
                <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${item.color}`} />
                <div>
                  <p className="text-sm leading-snug text-slate-800">{item.text}</p>
                  <p className="mt-1 font-mono text-xs text-slate-400">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-semibold text-slate-950">Top products</p>
              <span className="text-sm text-slate-400">Live sales</span>
            </div>
            <div className="space-y-2">
              {topProducts.length ? (
                topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0">
                    <span className="w-6 font-mono text-sm text-slate-400">#{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-950">{product.name}</p>
                      <p className="font-mono text-xs text-slate-400">{product.brand}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-950">{fmt(product.revenue)}</p>
                      <p className="font-mono text-xs text-slate-400">{product.soldQuantity} sold</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-4 font-mono text-sm text-slate-400">No product sales data yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-semibold text-slate-950">Low stock watch</p>
              <span className="text-sm text-slate-400">Needs attention</span>
            </div>
            <div className="space-y-2">
              {lowStockItems.length ? (
                lowStockItems.map((product) => (
                  <div key={product.id} className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-950">{product.name}</p>
                      <p className="font-mono text-xs text-slate-400">{product.brand?.name || "Unbranded"}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-semibold font-mono ${product.stock === 0 ? "text-rose-600" : "text-amber-600"}`}>
                        {product.stock}
                      </p>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">units</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="mt-1 rounded-sm border border-dashed border-slate-200 px-4 py-5 font-mono text-sm text-slate-400">
                  No stock issues detected.
                </p>
              )}
            </div>
          </div>
        </section>

      
      </main>
    </div>
  );
}
