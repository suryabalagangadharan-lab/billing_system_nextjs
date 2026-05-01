"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast-provider";

function fmt(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const thisYear = () => String(new Date().getFullYear());

// ── Primitives ───────────────────────────────────────────────────────────────

function Label({ children }) {
  return (
    <span className="block text-[13px] font-medium text-slate-500 mb-1 tracking-wide uppercase">
      {children}
    </span>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full border border-slate-200 rounded-lg bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-slate-400 transition-colors placeholder:text-slate-300 ${className}`}
      {...props}
    />
  );
}

function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
      <div>
        <p className="text-[14px] font-medium text-slate-900">{title}</p>
        {subtitle && <p className="text-[13px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && action}
    </div>
  );
}

function StatCard({ label, value, sub, warn, blue, green }) {
  const accent = warn ? "bg-amber-50" : blue ? "bg-blue-50" : green ? "bg-emerald-50" : "";
  const labelColor = warn
    ? "text-amber-600"
    : blue
    ? "text-blue-600"
    : green
    ? "text-emerald-600"
    : "text-slate-400";
  const valueColor = warn
    ? "text-amber-700"
    : blue
    ? "text-blue-700"
    : green
    ? "text-emerald-700"
    : "text-slate-900";
  const subColor = warn
    ? "text-amber-500"
    : blue
    ? "text-blue-400"
    : green
    ? "text-emerald-500"
    : "text-slate-400";

  return (
    <div className={`px-5 py-4 ${accent}`}>
      <p className={`text-[13px] font-medium tracking-wide uppercase mb-1 ${labelColor}`}>{label}</p>
      <p className={`text-[20px] font-medium ${valueColor}`}>{value}</p>
      {sub && <p className={`text-[12px] mt-0.5 ${subColor}`}>{sub}</p>}
    </div>
  );
}

function ExportDateField({ label, inputType, value, onChange }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <Input type={inputType} value={value} onChange={onChange} />
    </label>
  );
}

// ── Mini bar chart for monthly breakdown ──────────────────────────────────────

function MiniBarChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => Number(d.invoiceRevenue || 0)), 1);

  return (
    <div className="flex items-end gap-1.5 h-14">
      {data.map((d) => {
        const pct = Math.max((Number(d.invoiceRevenue || 0) / maxVal) * 100, 2);
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
            <div
              className="w-full rounded-sm bg-slate-900 transition-all group-hover:bg-blue-600"
              style={{ height: `${pct}%` }}
            />
            <span className="text-[10px] text-slate-400 truncate w-full text-center">
              {d.date?.slice(-2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Stock level pill ──────────────────────────────────────────────────────────

function StockPill({ stock }) {
  if (stock === 0)
    return (
      <span className="text-[12px] font-medium px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200">
        Out of stock
      </span>
    );
  if (stock <= 5)
    return (
      <span className="text-[12px] font-medium px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
        Low · {stock}
      </span>
    );
  return (
    <span className="text-[12px] font-medium px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
      {stock} left
    </span>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function Skeleton({ rows = 3, height = "h-12" }) {
  return (
    <div className="flex flex-col gap-3 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${height} bg-slate-100 rounded-xl animate-pulse`} />
      ))}
    </div>
  );
}

function PaginationBar({ page, totalPages, onPrev, onNext, label, totalCount, start, end }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[13px] text-slate-400">
        {label}
        {totalCount != null && start != null && end != null && (
          <>
            {" "}
            <span className="text-slate-700 font-medium">{start}</span>
            <span>–</span>
            <span className="text-slate-700 font-medium">{end}</span>
            <span> of </span>
            <span className="text-slate-700 font-medium">{totalCount}</span>
          </>
        )}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:hover:bg-white"
        >
          Prev
        </button>
        <div className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-700">
          Page <span className="font-medium">{page}</span> / <span className="font-medium">{totalPages}</span>
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:hover:bg-white"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ReportsClient() {
  const { pushToast } = useToast();
  const [reportDate, setReportDate] = useState(today);
  const [reportMonth, setReportMonth] = useState(thisMonth);
  const [reportYear, setReportYear] = useState(thisYear);
  const [productSearch, setProductSearch] = useState("");
  const [activeExport, setActiveExport] = useState(null); // 'daily' | 'monthly' | 'yearly'
  const [breakdownPage, setBreakdownPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const [stockPage, setStockPage] = useState(1);
  const [state, setState] = useState({
    loading: true,
    error: "",
    daily: null,
    monthly: null,
    yearly: null,
    product: null,
    stock: null,
  });

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
        const [daily, monthly, yearly, product, stock] = await Promise.all([
          dR.json(), mR.json(), yR.json(), pR.json(), sR.json(),
        ]);
        if (!active) return;
        if (!dR.ok || !mR.ok || !yR.ok || !pR.ok || !sR.ok)
          throw new Error(daily.error || "Unable to load reports.");
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

  const breakdown = (state.monthly?.breakdown || []).slice(-10);
  const breakdownPageSize = 5;
  const productPageSize = 6;
  const stockPageSize = 8;

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return (state.product?.products || []).filter(
      (p) =>
        !q ||
        [p.name, p.brand?.name ?? p.brand, p.sku].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [productSearch, state.product]);

  const breakdownTotalPages = Math.max(1, Math.ceil(breakdown.length / breakdownPageSize));
  const productTotalPages = Math.max(1, Math.ceil(filteredProducts.length / productPageSize));
  const stockProducts = state.stock?.products || [];
  const stockTotalPages = Math.max(1, Math.ceil(stockProducts.length / stockPageSize));

  const breakdownStart = (breakdownPage - 1) * breakdownPageSize;
  const productStart = (productPage - 1) * productPageSize;
  const stockStart = (stockPage - 1) * stockPageSize;

  const breakdownSlice = breakdown.slice(breakdownStart, breakdownStart + breakdownPageSize);
  const productSlice = filteredProducts.slice(productStart, productStart + productPageSize);
  const stockSlice = stockProducts.slice(stockStart, stockStart + stockPageSize);

  useEffect(() => {
    setBreakdownPage(1);
  }, [reportMonth]);

  useEffect(() => {
    setProductPage(1);
  }, [productSearch]);

  useEffect(() => {
    setStockPage(1);
  }, [stockProducts.length]);

  const { loading } = state;

  const outOfStock = state.stock?.summary?.outOfStockCount ?? 0;
  const lowStock = state.stock?.summary?.lowStockCount ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top bar ── */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-screen-xl mx-auto px-6 h-[52px] flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-[15px] font-medium text-slate-900">OpsHub</span>
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-[14px] font-medium text-slate-900">Reports</span>
          </div>
          <div className="flex-1" />
          {!loading && (
            <span className="text-[13px] text-slate-400">
              {filteredProducts.length} products tracked
            </span>
          )}
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6 pt-6 pb-2">
        <h1 className="text-[19px] font-medium text-slate-900">Insight layer</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          Revenue snapshots, product movers, stock health, and exports.
        </p>
      </div>

      {/* ── Error banner ── */}
      {state.error && (
        <div className="max-w-screen-xl mx-auto px-6 pt-4">
          <div className="border border-red-100 bg-red-50 rounded-xl px-4 py-3 text-[13px] text-red-600">
            {state.error}
          </div>
        </div>
      )}

      {/* ── Stats grid ── */}
      <div className="max-w-screen-xl mx-auto px-6 pt-4 pb-2">
        <div className="grid grid-cols-4 bg-white border border-slate-200 rounded-xl overflow-hidden divide-x divide-slate-100">
          <StatCard
            label="Daily revenue"
            value={loading ? "—" : fmt(state.daily?.summary?.invoiceRevenue)}
            sub={`Invoices · ${reportDate}`}
            green={!loading && Number(state.daily?.summary?.invoiceRevenue) > 0}
          />
          <StatCard
            label="Monthly revenue"
            value={loading ? "—" : fmt(state.monthly?.summary?.invoiceRevenue)}
            sub={`Invoices · ${reportMonth}`}
            blue={!loading && Number(state.monthly?.summary?.invoiceRevenue) > 0}
          />
          <StatCard
            label="Yearly revenue"
            value={loading ? "—" : fmt(state.yearly?.summary?.invoiceRevenue)}
            sub={`Invoices · ${reportYear}`}
          />
          <StatCard
            label="Out of stock"
            value={loading ? "—" : outOfStock}
            sub="Need replenishment"
            warn={!loading && outOfStock > 0}
          />
        </div>
      </div>

      {/* ── Low stock alert ── */}
      {!loading && lowStock > 0 && (
        <div className="max-w-screen-xl mx-auto px-6 pt-3">
          <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 text-[13px] text-amber-700 flex items-center gap-2 flex-wrap">
            <span>⚠</span>
            <span className="font-medium">{lowStock} product{lowStock !== 1 ? "s" : ""}</span>
            <span>at low stock — review inventory before next service jobs.</span>
          </div>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="max-w-screen-xl mx-auto px-6 pt-4 pb-4 grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* ── LEFT: Export panel ── */}
        <div className="flex flex-col gap-4">

          {/* Export selector tabs */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <CardHeader title="Download reports" subtitle="Export sales data as Excel files" />

            {/* Tab switcher */}
            <div className="flex border-b border-slate-100">
              {[
                { key: "daily", label: "Daily" },
                { key: "monthly", label: "Monthly" },
                { key: "yearly", label: "Yearly" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveExport(activeExport === key ? null : key)}
                  className={`flex-1 py-2.5 text-[13px] font-medium transition-colors ${
                    activeExport === key
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Daily */}
            <div
              className={`overflow-hidden transition-all duration-200 ${
                activeExport === "daily" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="p-5 flex flex-col gap-4">
                <p className="text-[13px] text-slate-400">
                  Download a single-day sales report including all invoices, parts, and service jobs.
                </p>
                <ExportDateField
                  label="Select date"
                  inputType="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                />
                <button
                  onClick={() => download(`/api/reports/daily?date=${encodeURIComponent(reportDate)}&format=xlsx`)}
                  className="text-[13px] font-medium py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  Download daily report →
                </button>
              </div>
            </div>

            {/* Monthly */}
            <div
              className={`overflow-hidden transition-all duration-200 ${
                activeExport === "monthly" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="p-5 flex flex-col gap-4">
                <p className="text-[13px] text-slate-400">
                  Download a full month breakdown with day-by-day revenue, purchases, and service totals.
                </p>
                <ExportDateField
                  label="Select month"
                  inputType="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                />
                <button
                  onClick={() => download(`/api/reports/monthly?month=${encodeURIComponent(reportMonth)}&format=xlsx`)}
                  className="text-[13px] font-medium py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  Download monthly report →
                </button>
              </div>
            </div>

            {/* Yearly */}
            <div
              className={`overflow-hidden transition-all duration-200 ${
                activeExport === "yearly" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="p-5 flex flex-col gap-4">
                <p className="text-[13px] text-slate-400">
                  Download an annual summary with monthly totals, top products, and overall performance.
                </p>
                <ExportDateField
                  label="Year"
                  inputType="text"
                  value={reportYear}
                  onChange={(e) => setReportYear(e.target.value)}
                />
                <button
                  onClick={() => download(`/api/reports/yearly?year=${encodeURIComponent(reportYear)}&format=xlsx`)}
                  className="text-[13px] font-medium py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  Download yearly report →
                </button>
              </div>
            </div>

            {/* Collapsed state */}
            {!activeExport && (
              <div className="p-5">
                <p className="text-[13px] text-slate-400 text-center">Select a period above to configure and download.</p>
              </div>
            )}
          </div>

          {/* ── Revenue summary cards (daily / monthly / yearly) ── */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <CardHeader title="Revenue breakdown" subtitle={`Period comparison`} />
            <div className="p-5 flex flex-col gap-3">
              {loading ? (
                <Skeleton rows={3} height="h-14" />
              ) : (
                [
                  {
                    label: "Daily",
                    period: reportDate,
                    invoice: state.daily?.summary?.invoiceRevenue,
                    service: state.daily?.summary?.serviceRevenue,
                    purchases: state.daily?.summary?.purchaseSpend,
                  },
                  {
                    label: "Monthly",
                    period: reportMonth,
                    invoice: state.monthly?.summary?.invoiceRevenue,
                    service: state.monthly?.summary?.serviceRevenue,
                    purchases: state.monthly?.summary?.purchaseSpend,
                  },
                  {
                    label: "Yearly",
                    period: reportYear,
                    invoice: state.yearly?.summary?.invoiceRevenue,
                    service: state.yearly?.summary?.serviceRevenue,
                    purchases: state.yearly?.summary?.purchaseSpend,
                  },
                ].map(({ label, period, invoice, service, purchases }) => (
                  <div key={label} className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                      <p className="text-[13px] font-medium text-slate-900">{label}</p>
                      <span className="text-[12px] text-slate-400">{period}</span>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-slate-100">
                      {[
                        { l: "Invoices", v: invoice },
                        { l: "Service", v: service },
                        { l: "Purchases", v: purchases },
                      ].map(({ l, v }) => (
                        <div key={l} className="px-4 py-3">
                          <p className="text-[12px] text-slate-400 mb-0.5">{l}</p>
                          <p className="text-[14px] font-medium text-slate-900">{fmt(v)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Monthly breakdown + product movers ── */}
        <div className="flex flex-col gap-4">

          {/* Monthly breakdown table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <CardHeader
              title="Monthly breakdown"
              subtitle={`Page ${breakdownPage} of ${breakdownTotalPages} · ${reportMonth}`}
            />

            {loading ? (
              <Skeleton rows={4} height="h-10" />
            ) : breakdown.length > 0 ? (
              <>
                {/* Mini sparkline chart */}
                <div className="px-5 pt-4 pb-2">
                  <MiniBarChart data={breakdownSlice} />
                </div>

                {/* Table */}
                <div className="px-5 pb-5">
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-4 gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      {["Date", "Invoices", "Purchases", "Service"].map((h) => (
                        <p key={h} className="text-[12px] font-medium text-slate-400 tracking-wide uppercase">{h}</p>
                      ))}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {breakdownSlice.map((row) => (
                        <div key={row.date} className="grid grid-cols-4 gap-2 px-4 py-3 hover:bg-slate-50 transition-colors">
                          <p className="text-[13px] font-medium text-slate-900">{row.date}</p>
                          <p className="text-[13px] text-slate-700">{fmt(row.invoiceRevenue)}</p>
                          <p className="text-[13px] text-slate-700">{fmt(row.purchaseSpend)}</p>
                          <p className="text-[13px] text-slate-700">{fmt(row.serviceRevenue)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <PaginationBar
                  page={breakdownPage}
                  totalPages={breakdownTotalPages}
                  onPrev={() => setBreakdownPage((p) => Math.max(1, p - 1))}
                  onNext={() => setBreakdownPage((p) => Math.min(breakdownTotalPages, p + 1))}
                  label="Showing"
                  totalCount={breakdown.length}
                  start={breakdownStart + 1}
                  end={Math.min(breakdownStart + breakdownPageSize, breakdown.length)}
                />
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-[14px] text-slate-300">No data for {reportMonth}.</p>
              </div>
            )}
          </div>

          {/* Top product movers */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <CardHeader
              title="Top product movers"
              subtitle={`${filteredProducts.length} product${filteredProducts.length !== 1 ? "s" : ""} tracked`}
              action={
                <div className="relative w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none text-[14px]">⌕</span>
                  <Input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Filter products…"
                    className="pl-8"
                  />
                </div>
              }
            />

            {loading ? (
              <Skeleton rows={4} height="h-16" />
            ) : filteredProducts.length > 0 ? (
              <>
                <div className="divide-y divide-slate-100">
                {productSlice.map((p, idx) => (
                  <div key={p.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="text-[12px] font-medium text-slate-300 mt-0.5 w-4 shrink-0">
                          {productStart + idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-slate-900 truncate">{p.name}</p>
                          <p className="text-[13px] text-slate-400">{p.brand?.name ?? p.brand ?? "Unbranded"} · {p.sku}</p>
                        </div>
                      </div>
                      <StockPill stock={p.currentStock} />
                    </div>

                    {/* Metrics row */}
                    <div className="grid grid-cols-3 gap-3 ml-7">
                      {[
                        { label: "Sold", value: p.soldQuantity ?? 0, unit: "units" },
                        { label: "Revenue", value: fmt(p.salesRevenue), unit: null },
                        { label: "In service", value: p.serviceQuantity ?? 0, unit: "uses" },
                      ].map(({ label, value, unit }) => (
                        <div key={label} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                          <p className="text-[11px] text-slate-400 mb-0.5 uppercase tracking-wide">{label}</p>
                          <p className="text-[13px] font-medium text-slate-900">{value}</p>
                          {unit && <p className="text-[11px] text-slate-300">{unit}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                </div>
                <PaginationBar
                  page={productPage}
                  totalPages={productTotalPages}
                  onPrev={() => setProductPage((p) => Math.max(1, p - 1))}
                  onNext={() => setProductPage((p) => Math.min(productTotalPages, p + 1))}
                  label="Showing"
                  totalCount={filteredProducts.length}
                  start={productStart + 1}
                  end={Math.min(productStart + productPageSize, filteredProducts.length)}
                />
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-[14px] text-slate-300 mb-3">
                  {productSearch ? "No products match the search." : "No product data yet."}
                </p>
                {productSearch && (
                  <button
                    onClick={() => setProductSearch("")}
                    className="text-[13px] px-4 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stock health register ── */}
      <div className="max-w-screen-xl mx-auto px-6 pb-8">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <CardHeader
            title="Stock health"
            subtitle={`${state.stock?.products?.length ?? 0} products · ${outOfStock} out of stock · ${lowStock} low`}
          />

          {loading ? (
            <Skeleton rows={5} height="h-12" />
          ) : (state.stock?.products?.length ?? 0) > 0 ? (
            <>
              {/* Table header */}
              <div className="grid px-5 py-2.5 bg-slate-50 border-b border-slate-100"
                style={{ gridTemplateColumns: "1fr 1fr 0.7fr 0.7fr 0.8fr" }}>
                {["Product", "Brand / SKU", "Stock", "Reorder at", "Status"].map((h) => (
                  <p key={h} className="text-[12px] font-medium text-slate-400 tracking-wide uppercase">{h}</p>
                ))}
              </div>

              <div className="divide-y divide-slate-100">
                {stockSlice.map((p) => (
                  <div
                    key={p.id}
                    className="grid items-center px-5 py-3.5 hover:bg-slate-50 transition-colors"
                    style={{ gridTemplateColumns: "1fr 1fr 0.7fr 0.7fr 0.8fr" }}
                  >
                    <p className="text-[14px] font-medium text-slate-900 truncate pr-4">{p.name}</p>
                    <div className="min-w-0 pr-4">
                      <p className="text-[13px] text-slate-700 truncate">{p.brand?.name ?? p.brand ?? "—"}</p>
                      <p className="text-[12px] text-slate-400 truncate">{p.sku || "No SKU"}</p>
                    </div>
                    <p className="text-[14px] font-medium text-slate-900">{p.stock ?? "—"}</p>
                    <p className="text-[13px] text-slate-500">{p.reorderPoint ?? "—"}</p>
                    <StockPill stock={p.stock ?? 0} />
                  </div>
                ))}
              </div>
              <PaginationBar
                page={stockPage}
                totalPages={stockTotalPages}
                onPrev={() => setStockPage((p) => Math.max(1, p - 1))}
                onNext={() => setStockPage((p) => Math.min(stockTotalPages, p + 1))}
                label="Showing"
                totalCount={stockProducts.length}
                start={stockStart + 1}
                end={Math.min(stockStart + stockPageSize, stockProducts.length)}
              />
            </>
          ) : (
            <div className="py-14 text-center">
              <p className="text-[14px] text-slate-300">No stock data available.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
