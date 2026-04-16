"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import AppShell from "@/components/app-shell";
import { Panel, SectionHeading, StatCard } from "@/components/ui";

function fmt(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
}
function fmtCompact(value) {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-slate-200 bg-white px-3 py-2.5 shadow-sm rounded-sm text-xs font-mono">
      {label && <p className="text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-6">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="text-slate-900 font-medium">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="border border-slate-200 rounded-sm px-5 py-4 bg-white">
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 tracking-tight">{value}</p>
      {sub && <p className="text-xs font-mono text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <div className="border border-slate-200 rounded-sm bg-white p-5">
      <div className="mb-4">
        <p className="text-xs font-mono font-semibold text-slate-900 uppercase tracking-[0.15em]">{title}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export default function DashboardClient() {
  const [chartsReady, setChartsReady] = useState(false);
  const [state, setState] = useState({ loading: true, error: "", daily: null, monthly: null, product: null, stock: null });

  useEffect(() => { setChartsReady(true); }, []);

  useEffect(() => {
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
        const [d, m, p, s] = results;
        setState({
          loading: false,
          error: "",
          daily: d.status === "fulfilled" && d.value.ok ? d.value.payload : null,
          monthly: m.status === "fulfilled" && m.value.ok ? m.value.payload : null,
          product: p.status === "fulfilled" && p.value.ok ? p.value.payload : null,
          stock: s.status === "fulfilled" && s.value.ok ? s.value.payload : null,
        });
      } catch (e) {
        if (!active) return;
        setState((c) => ({ ...c, loading: false, error: e.message || "Unable to load dashboard." }));
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const trendData = (state.monthly?.breakdown || []).slice(-7).map((e) => ({
    date: e.date.slice(5),
    Sales: Number(e.invoiceRevenue || 0),
    Service: Number(e.serviceRevenue || 0),
  }));

  const topProducts = useMemo(() =>
    [...(state.product?.products || [])]
      .sort((a, b) => Number(b.salesRevenue || 0) - Number(a.salesRevenue || 0))
      .slice(0, 5)
      .map((p) => ({ name: p.name, revenue: Number(p.salesRevenue || 0), soldQuantity: p.soldQuantity, stock: p.currentStock, brand: p.brand || "Unbranded" })),
    [state.product]
  );

  const stockData = useMemo(() => {
    const products = state.stock?.products || [];
    return [
      { name: "Healthy", value: products.filter((p) => p.stock > 5).length, color: "#0f766e" },
      { name: "Low", value: products.filter((p) => p.stock > 0 && p.stock <= 5).length, color: "#b45309" },
      { name: "Out", value: products.filter((p) => p.stock === 0).length, color: "#be123c" },
    ];
  }, [state.stock]);

  const lowStockItems = (state.stock?.products || []).slice(0, 6);
  const loading = state.loading;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 pb-5 mb-8">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-1">Operations Hub</p>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        </div>
        <span className="text-[10px] font-mono text-slate-400 border border-slate-200 rounded-sm px-2 py-1 bg-white">
          {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </div>

      {state.error && (
        <div className="border border-amber-200 bg-amber-50 rounded-sm px-4 py-3 mb-6">
          <p className="text-xs font-mono text-amber-700">{state.error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <Stat label="Daily Sales" value={loading ? "—" : fmt(state.daily?.summary?.invoiceRevenue)} sub={`${state.daily?.summary?.invoiceCount ?? 0} invoices today`} />
        <Stat label="Monthly Sales" value={loading ? "—" : fmt(state.monthly?.summary?.invoiceRevenue)} sub={`${state.monthly?.summary?.invoiceCount ?? 0} invoices`} />
        <Stat label="Top Products" value={loading ? "—" : topProducts.length} sub="By sales revenue" />
        <Stat label="Stock Alerts" value={loading ? "—" : state.stock?.summary?.lowStockCount ?? 0} sub={`${state.stock?.summary?.outOfStockCount ?? 0} out of stock`} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr] mb-4">
        <Section title="Sales Trend" description="Last 7 days — invoice billing vs service revenue">
          <div className="h-64">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="2 2" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "monospace" }} />
                  <YAxis tickFormatter={fmtCompact} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "monospace" }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Sales" fill="#0f172a" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Service" fill="#cbd5e1" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full animate-pulse bg-slate-100 rounded-sm" />
            )}
          </div>
        </Section>

        <Section title="Stock Summary" description="Catalog health at a glance">
          <div className="h-44">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stockData} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={3}>
                    {stockData.map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ borderRadius: 2, borderColor: "#e2e8f0", fontSize: 12, fontFamily: "monospace" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full animate-pulse bg-slate-100 rounded-sm" />
            )}
          </div>
          <div className="border-t border-slate-100 pt-3 mt-2 space-y-2">
            {stockData.map((e) => (
              <div key={e.name} className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: e.color }} />
                  <span className="text-slate-500 uppercase tracking-widest text-[10px]">{e.name}</span>
                </div>
                <span className="text-slate-900 font-semibold">{e.value}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Bottom panels */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Top Products" description="Ranked by invoice sales revenue">
          <div className="space-y-2 mt-1">
            {topProducts.length ? topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                <span className="text-[10px] font-mono text-slate-400 w-5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                  <p className="text-xs font-mono text-slate-400">{p.brand}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{fmt(p.revenue)}</p>
                  <p className="text-[10px] font-mono text-slate-400">{p.soldQuantity} sold</p>
                </div>
              </div>
            )) : <p className="text-xs font-mono text-slate-400 py-4">No product sales data yet.</p>}
          </div>
        </Section>

        <Section title="Low Stock Watch" description="Products needing immediate attention">
          <div className="space-y-2 mt-1">
            {lowStockItems.length ? lowStockItems.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs font-mono text-slate-400">{p.brand?.name || "Unbranded"}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-semibold font-mono ${p.stock === 0 ? "text-rose-600" : "text-amber-600"}`}>{p.stock}</p>
                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">units</p>
                </div>
              </div>
            )) : (
              <p className="text-xs font-mono text-slate-400 border border-dashed border-slate-200 rounded-sm px-4 py-5 mt-1">
                No stock issues detected.
              </p>
            )}
          </div>
        </Section>
      </div>
    </main>
  );
}