"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast-provider";

function fmt(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const thisYear = () => String(new Date().getFullYear());

function Stat({ label, value, sub }) {
  return (
    <div className="border border-slate-200 rounded-sm px-5 py-4 bg-white">
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 font-mono tracking-tight">{value}</p>
      {sub && <p className="text-xs font-mono text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ExportCard({ title, description, type, inputType, value, onChange, onDownload }) {
  return (
    <div className="border border-slate-200 rounded-sm bg-white p-5">
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-900 font-semibold mb-1">{title}</p>
      <p className="text-xs font-mono text-slate-400 mb-4">{description}</p>
      <label className="block mb-3">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500">
          {type === "date" ? "Date" : type === "month" ? "Month" : "Year"}
        </span>
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          className="mt-1.5 w-full border border-slate-200 rounded-sm px-3 py-2.5 text-sm font-mono text-slate-900 outline-none focus:border-slate-900 bg-white"
        />
      </label>
      <button
        onClick={onDownload}
        className="w-full bg-slate-900 text-white text-xs font-mono py-3 rounded-sm hover:bg-slate-700 transition-colors"
      >
        download excel →
      </button>
    </div>
  );
}

export default function ReportsClient() {
  const { pushToast } = useToast();
  const [reportDate, setReportDate] = useState(today);
  const [reportMonth, setReportMonth] = useState(thisMonth);
  const [reportYear, setReportYear] = useState(thisYear);
  const [state, setState] = useState({ loading: true, error: "", daily: null, monthly: null, yearly: null, product: null, stock: null });
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setState((c) => ({ ...c, loading: true, error: "" }));
      try {
        const [dR, mR, yR, pR, sR] = await Promise.all([
          fetch(`/api/reports/daily?date=${encodeURIComponent(reportDate)}`),
          fetch(`/api/reports/monthly?month=${encodeURIComponent(reportMonth)}`),
          fetch(`/api/reports/yearly?year=${encodeURIComponent(reportYear)}`),
          fetch("/api/reports/product"),
          fetch("/api/reports/stock"),
        ]);
        const [daily, monthly, yearly, product, stock] = await Promise.all([dR.json(), mR.json(), yR.json(), pR.json(), sR.json()]);
        if (!active) return;
        if (!dR.ok || !mR.ok || !yR.ok || !pR.ok || !sR.ok) throw new Error(daily.error || "Unable to load reports.");
        setState({ loading: false, error: "", daily, monthly, yearly, product, stock });
      } catch (e) {
        if (!active) return;
        pushToast({ title: "Reports unavailable", description: e.message, tone: "error" });
        setState((c) => ({ ...c, loading: false, error: e.message }));
      }
    }
    load();
    return () => { active = false; };
  }, [pushToast, reportDate, reportMonth, reportYear]);

  const download = (path) => window.open(path, "_blank", "noopener,noreferrer");

  const breakdown = (state.monthly?.breakdown || []).slice(-6);
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return (state.product?.products || []).filter((p) =>
      !q || [p.name, p.brand, p.sku].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [productSearch, state.product]);

  const { loading } = state;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 pb-5 mb-6">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-1">Insight Layer</p>
          <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
        </div>
      </div>

      {state.error && (
        <div className="border border-rose-200 bg-rose-50 rounded-sm px-4 py-2.5 mb-6 text-xs font-mono text-rose-700">{state.error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <Stat label="Daily Revenue" value={loading ? "—" : fmt(state.daily?.summary?.invoiceRevenue)} sub={`Invoices ${reportDate}`} />
        <Stat label="Monthly Revenue" value={loading ? "—" : fmt(state.monthly?.summary?.invoiceRevenue)} sub={`Invoices ${reportMonth}`} />
        <Stat label="Yearly Revenue" value={loading ? "—" : fmt(state.yearly?.summary?.invoiceRevenue)} sub={`Invoices ${reportYear}`} />
        <Stat label="Out of Stock" value={loading ? "—" : state.stock?.summary?.outOfStockCount ?? 0} sub="Need replenishment" />
      </div>

      {(state.stock?.summary?.lowStockCount ?? 0) > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-sm px-4 py-2.5 mb-6 text-xs font-mono text-amber-700">
          ⚠ {state.stock.summary.lowStockCount} products at low stock. Review needed.
        </div>
      )}

      {/* Export cards */}
      <div className="grid gap-3 xl:grid-cols-3 mb-6">
        <ExportCard
          title="Daily Export" description="Download single-day sales report."
          type="date" inputType="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)}
          onDownload={() => download(`/api/reports/daily?date=${encodeURIComponent(reportDate)}&format=xlsx`)}
        />
        <ExportCard
          title="Monthly Export" description="Download full month sales breakdown."
          type="month" inputType="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)}
          onDownload={() => download(`/api/reports/monthly?month=${encodeURIComponent(reportMonth)}&format=xlsx`)}
        />
        <ExportCard
          title="Yearly Export" description="Download annual summary report."
          type="year" inputType="text" value={reportYear} onChange={(e) => setReportYear(e.target.value)}
          onDownload={() => download(`/api/reports/yearly?year=${encodeURIComponent(reportYear)}&format=xlsx`)}
        />
      </div>

      {/* Data panels */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Monthly breakdown */}
        <div className="border border-slate-200 rounded-sm bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-900 font-semibold mb-4">Monthly Breakdown</p>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-sm animate-pulse" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-slate-400 bg-slate-50 rounded-sm mb-1">
                <span>Date</span><span>Invoice</span><span>Purchase</span><span>Service</span>
              </div>
              <div className="space-y-1">
                {breakdown.length ? breakdown.map((row) => (
                  <div key={row.date} className="grid grid-cols-4 gap-2 px-3 py-3 text-xs font-mono border-b border-slate-100 last:border-0">
                    <p className="text-slate-900 font-medium">{row.date}</p>
                    <p className="text-slate-600">{fmt(row.invoiceRevenue)}</p>
                    <p className="text-slate-600">{fmt(row.purchaseSpend)}</p>
                    <p className="text-slate-600">{fmt(row.serviceRevenue)}</p>
                  </div>
                )) : (
                  <p className="text-xs font-mono text-slate-400 py-4 px-3">No monthly data yet.</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Top product movers */}
        <div className="border border-slate-200 rounded-sm bg-white p-5">
          <div className="flex items-center justify-between mb-4 gap-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-900 font-semibold">Top Product Movers</p>
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search..."
              className="border border-slate-200 rounded-sm px-3 py-2 text-xs font-mono text-slate-900 outline-none focus:border-slate-900 bg-white placeholder:text-slate-300"
            />
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-sm animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredProducts.slice(0, 5).length ? filteredProducts.slice(0, 5).map((p) => (
                <div key={p.id} className="border-b border-slate-100 last:border-0 py-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs font-mono text-slate-400">{p.brand || "Unbranded"}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-50 border border-slate-100 rounded-sm px-2 py-1">
                      {p.currentStock} left
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    <div>
                      <p className="text-slate-400">sold</p>
                      <p className="text-slate-900 font-semibold">{p.soldQuantity}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">revenue</p>
                      <p className="text-slate-900 font-semibold">{fmt(p.salesRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">service</p>
                      <p className="text-slate-900 font-semibold">{p.serviceQuantity}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-xs font-mono text-slate-400 py-4">No products match the search.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}