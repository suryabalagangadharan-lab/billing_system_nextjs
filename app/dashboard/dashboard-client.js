"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppShell from "@/components/app-shell";
import { Panel, SectionHeading, StatCard } from "@/components/ui";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatCompactCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      {label ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p> : null}
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-sm">
            <span style={{ color: entry.color }}>{entry.name}</span>
            <span className="font-medium text-slate-950">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardClient() {
  const [chartsReady, setChartsReady] = useState(false);
  const [state, setState] = useState({
    loading: true,
    error: "",
    daily: null,
    monthly: null,
    product: null,
    stock: null,
  });

  useEffect(() => {
    setChartsReady(true);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const requests = await Promise.allSettled([
          fetch("/api/reports/daily").then(async (response) => ({
            ok: response.ok,
            payload: await response.json(),
          })),
          fetch("/api/reports/monthly").then(async (response) => ({
            ok: response.ok,
            payload: await response.json(),
          })),
          fetch("/api/reports/product").then(async (response) => ({
            ok: response.ok,
            payload: await response.json(),
          })),
          fetch("/api/reports/stock").then(async (response) => ({
            ok: response.ok,
            payload: await response.json(),
          })),
        ]);

        if (!active) {
          return;
        }

        const [dailyResult, monthlyResult, productResult, stockResult] = requests;
        const daily =
          dailyResult.status === "fulfilled" && dailyResult.value.ok ? dailyResult.value.payload : null;
        const monthly =
          monthlyResult.status === "fulfilled" && monthlyResult.value.ok ? monthlyResult.value.payload : null;
        const product =
          productResult.status === "fulfilled" && productResult.value.ok ? productResult.value.payload : null;
        const stock =
          stockResult.status === "fulfilled" && stockResult.value.ok ? stockResult.value.payload : null;

        setState({
          loading: false,
          error: !daily && !monthly && !product && !stock ? "Dashboard reports are unavailable for this account." : "",
          daily,
          monthly,
          product,
          stock,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setState((current) => ({
          ...current,
          loading: false,
          error: error.message || "Unable to load dashboard.",
        }));
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const monthlyBreakdown = (state.monthly?.breakdown || []).slice(-7);
  const salesTrendData = monthlyBreakdown.map((entry) => ({
    date: entry.date.slice(5),
    Sales: Number(entry.invoiceRevenue || 0),
    Service: Number(entry.serviceRevenue || 0),
  }));

  const topProducts = useMemo(
    () =>
      [...(state.product?.products || [])]
        .sort((left, right) => Number(right.salesRevenue || 0) - Number(left.salesRevenue || 0))
        .slice(0, 5)
        .map((product) => ({
          name: product.name,
          revenue: Number(product.salesRevenue || 0),
          soldQuantity: product.soldQuantity,
          stock: product.currentStock,
          brand: product.brand || "Unbranded",
        })),
    [state.product]
  );

  const stockSummaryData = useMemo(() => {
    const products = state.stock?.products || [];
    const lowStockThreshold = 5;
    const outOfStock = products.filter((product) => product.stock === 0).length;
    const lowStock = products.filter((product) => product.stock > 0 && product.stock <= lowStockThreshold).length;
    const healthyStock = products.filter((product) => product.stock > lowStockThreshold).length;

    return [
      { name: "Healthy", value: healthyStock, color: "#0f766e" },
      { name: "Low", value: lowStock, color: "#f59e0b" },
      { name: "Out", value: outOfStock, color: "#e11d48" },
    ];
  }, [state.stock]);

  const lowStockItems = (state.stock?.products || []).slice(0, 6);

  return (
    <AppShell
      eyebrow="Operations Hub"
      title="Dashboard"
      description="Track total sales, top-selling products, stock health, and trend movement from one visual command center."
    >
      {state.error ? (
        <Panel className="border-amber-200 bg-amber-50/90">
          <p className="text-sm font-medium text-amber-700">{state.error}</p>
        </Panel>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Daily Sales"
          value={state.loading ? "..." : formatCurrency(state.daily?.summary?.invoiceRevenue)}
          hint={`${state.daily?.summary?.invoiceCount ?? 0} invoices today`}
          tone="cyan"
        />
        <StatCard
          label="Monthly Sales"
          value={state.loading ? "..." : formatCurrency(state.monthly?.summary?.invoiceRevenue)}
          hint={`${state.monthly?.summary?.invoiceCount ?? 0} invoices this month`}
        />
        <StatCard
          label="Top Products"
          value={state.loading ? "..." : topProducts.length}
          hint="Ranked by sales revenue"
          tone="amber"
        />
        <StatCard
          label="Stock Alerts"
          value={state.loading ? "..." : state.stock?.summary?.lowStockCount ?? 0}
          hint={`${state.stock?.summary?.outOfStockCount ?? 0} products already out`}
          tone="rose"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <Panel className="min-w-0">
          <SectionHeading
            title="Sales Trend"
            description="Daily revenue pattern for invoice billing and service work across the last week in the current month."
          />
          <div className="mt-6 h-80 min-w-0">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis
                    tickFormatter={formatCompactCurrency}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Sales" fill="#06b6d4" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="Service" fill="#0f172a" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full animate-pulse rounded-[1.5rem] bg-slate-100" />
            )}
          </div>
        </Panel>

        <Panel className="min-w-0">
          <SectionHeading
            title="Stock Summary"
            description="Quick picture of how much of the catalog is healthy, low, or already exhausted."
          />
          <div className="mt-6 h-80 min-w-0">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockSummaryData}
                    dataKey="value"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={4}
                  >
                    {stockSummaryData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value, name]}
                    contentStyle={{ borderRadius: 16, borderColor: "#e2e8f0" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full animate-pulse rounded-[1.5rem] bg-slate-100" />
            )}
          </div>
          <div className="mt-4 grid gap-3">
            {stockSummaryData.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm font-medium text-slate-700">{entry.name}</span>
                </div>
                <span className="text-sm font-semibold text-slate-950">{entry.value}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel>
          <SectionHeading
            title="Top Products"
            description="Highest-performing products ranked by invoice sales revenue."
          />
          <div className="mt-5 space-y-3">
            {topProducts.length ? (
              topProducts.map((product, index) => (
                <div key={product.name} className="rounded-[1.5rem] border border-slate-200 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                        #{index + 1}
                      </p>
                      <p className="mt-1 font-medium text-slate-950">{product.name}</p>
                      <p className="text-sm text-slate-500">{product.brand}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-slate-950">
                        {formatCurrency(product.revenue)}
                      </p>
                      <p className="text-sm text-slate-500">{product.soldQuantity} sold</p>
                    </div>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-cyan-500"
                      style={{
                        width: `${Math.max(
                          12,
                          (product.revenue / Math.max(...topProducts.map((item) => item.revenue), 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No product sales data available yet.</p>
            )}
          </div>
        </Panel>

        <Panel>
          <SectionHeading
            title="Low Stock Watch"
            description="Products closest to slowing down the counter or service desk."
          />
          <div className="mt-5 space-y-3">
            {lowStockItems.length ? (
              lowStockItems.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-[1.5rem] border border-slate-200 px-4 py-4"
                >
                  <div>
                    <p className="font-medium text-slate-950">{product.name}</p>
                    <p className="text-sm text-slate-500">{product.brand?.name || "Unbranded item"}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-semibold ${
                        product.stock === 0 ? "text-rose-600" : "text-amber-600"
                      }`}
                    >
                      {product.stock}
                    </p>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">units left</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-[1.5rem] border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                No stock issues detected yet.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
