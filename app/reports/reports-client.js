"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import { useToast } from "@/components/toast-provider";
import { AlertBanner, LoadingCard, Panel, SectionHeading, StatCard } from "@/components/ui";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getCurrentDate() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getCurrentYear() {
  return String(new Date().getFullYear());
}

export default function ReportsClient() {
  const { pushToast } = useToast();
  const [reportDate, setReportDate] = useState(getCurrentDate);
  const [reportMonth, setReportMonth] = useState(getCurrentMonth);
  const [reportYear, setReportYear] = useState(getCurrentYear);
  const [state, setState] = useState({
    loading: true,
    error: "",
    daily: null,
    monthly: null,
    yearly: null,
    product: null,
    stock: null,
  });
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function loadReports() {
      try {
        setState((current) => ({ ...current, loading: true, error: "" }));
        const [dailyRes, monthlyRes, yearlyRes, productRes, stockRes] = await Promise.all([
          fetch(`/api/reports/daily?date=${encodeURIComponent(reportDate)}`),
          fetch(`/api/reports/monthly?month=${encodeURIComponent(reportMonth)}`),
          fetch(`/api/reports/yearly?year=${encodeURIComponent(reportYear)}`),
          fetch("/api/reports/product"),
          fetch("/api/reports/stock"),
        ]);

        const [daily, monthly, yearly, product, stock] = await Promise.all([
          dailyRes.json(),
          monthlyRes.json(),
          yearlyRes.json(),
          productRes.json(),
          stockRes.json(),
        ]);

        if (!active) {
          return;
        }

        if (!dailyRes.ok || !monthlyRes.ok || !yearlyRes.ok || !productRes.ok || !stockRes.ok) {
          throw new Error(
            daily.error ||
              monthly.error ||
              yearly.error ||
              product.error ||
              stock.error ||
              "Unable to load reports."
          );
        }

        setState({
          loading: false,
          error: "",
          daily,
          monthly,
          yearly,
          product,
          stock,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        pushToast({
          title: "Reports unavailable",
          description: error.message || "Unable to load reports.",
          tone: "error",
        });

        setState((current) => ({
          ...current,
          loading: false,
          error: error.message || "Unable to load reports.",
        }));
      }
    }

    loadReports();

    return () => {
      active = false;
    };
  }, [pushToast, reportDate, reportMonth, reportYear]);

  function downloadReport(path) {
    window.open(path, "_blank", "noopener,noreferrer");
  }

  const topProducts = (state.product?.products || []).slice(0, 5);
  const breakdown = (state.monthly?.breakdown || []).slice(-6);
  const filteredProducts = useMemo(() => {
    const normalizedSearch = productSearch.trim().toLowerCase();

    return (state.product?.products || []).filter((product) =>
      !normalizedSearch
        ? true
        : [product.name, product.brand, product.sku]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch)
    );
  }, [productSearch, state.product]);
  const lowStockCount = state.stock?.summary?.lowStockCount ?? 0;

  return (
    <AppShell
      eyebrow="Insight Layer"
      title="Reports"
      description="Read the day, track the month and year, then export sales data in Excel anytime."
    >
      {state.error ? (
        <Panel className="border-rose-200 bg-rose-50/90">
          <p className="text-sm text-rose-700">{state.error}</p>
        </Panel>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Daily Revenue"
          value={state.loading ? "..." : formatCurrency(state.daily?.summary?.invoiceRevenue)}
          hint={`Invoices for ${reportDate}`}
          tone="cyan"
        />
        <StatCard
          label="Monthly Revenue"
          value={state.loading ? "..." : formatCurrency(state.monthly?.summary?.invoiceRevenue)}
          hint={`Invoices for ${reportMonth}`}
        />
        <StatCard
          label="Yearly Revenue"
          value={state.loading ? "..." : formatCurrency(state.yearly?.summary?.invoiceRevenue)}
          hint={`Invoices for ${reportYear}`}
          tone="amber"
        />
        <StatCard
          label="Out of Stock"
          value={state.loading ? "..." : state.stock?.summary?.outOfStockCount ?? 0}
          hint="Immediate replenishment required"
          tone="rose"
        />
      </div>

      {lowStockCount > 0 ? (
        <AlertBanner
          title="Stock attention required"
          description={`${lowStockCount} products are at low stock levels and need review.`}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel>
          <SectionHeading title="Daily Export" description="Select date and download report in Excel." />
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">Date</span>
            <input
              type="date"
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              downloadReport(
                `/api/reports/daily?date=${encodeURIComponent(reportDate)}&format=xlsx`
              )
            }
            className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Download Daily Excel
          </button>
        </Panel>

        <Panel>
          <SectionHeading title="Monthly Export" description="Pick month and export month-wise sales." />
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">Month</span>
            <input
              type="month"
              value={reportMonth}
              onChange={(event) => setReportMonth(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              downloadReport(
                `/api/reports/monthly?month=${encodeURIComponent(reportMonth)}&format=xlsx`
              )
            }
            className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Download Monthly Excel
          </button>
        </Panel>

        <Panel>
          <SectionHeading title="Yearly Export" description="Choose year and download annual report." />
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">Year</span>
            <input
              value={reportYear}
              onChange={(event) => setReportYear(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500"
              placeholder="2026"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              downloadReport(
                `/api/reports/yearly?year=${encodeURIComponent(reportYear)}&format=xlsx`
              )
            }
            className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Download Yearly Excel
          </button>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <Panel>
          <SectionHeading title="Monthly Breakdown" description="Recent daily trend line across revenue and stock spend." />
          <div className="mt-5 space-y-3">
            {state.loading ? (
              <div className="grid gap-3">
                <LoadingCard lines={2} />
                <LoadingCard lines={2} />
              </div>
            ) : breakdown.length ? (
              breakdown.map((row) => (
                <div key={row.date} className="grid grid-cols-[0.7fr_1fr_1fr_1fr] gap-3 rounded-[1.5rem] border border-slate-200 px-4 py-4 text-sm">
                  <p className="font-medium text-slate-950">{row.date}</p>
                  <p className="text-slate-600">{formatCurrency(row.invoiceRevenue)}</p>
                  <p className="text-slate-600">{formatCurrency(row.purchaseSpend)}</p>
                  <p className="text-slate-600">{formatCurrency(row.serviceRevenue)}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No monthly data available yet.</p>
            )}
          </div>
        </Panel>

        <Panel>
          <SectionHeading
            title="Top Product Movers"
            description="Revenue-heavy items that are doing the most work."
            action={
              <input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-cyan-500"
                placeholder="Search products"
              />
            }
          />
          <div className="mt-5 space-y-3">
            {state.loading ? (
              <div className="grid gap-3">
                <LoadingCard lines={2} />
                <LoadingCard lines={2} />
              </div>
            ) : filteredProducts.length ? (
              filteredProducts.slice(0, 5).map((product) => (
                <div key={product.id} className="rounded-[1.5rem] border border-slate-200 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-950">{product.name}</p>
                      <p className="text-sm text-slate-500">{product.brand || "Unbranded"}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {product.currentStock} left
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">Sold</p>
                      <p className="font-semibold text-slate-950">{product.soldQuantity}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Sales</p>
                      <p className="font-semibold text-slate-950">{formatCurrency(product.salesRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Service use</p>
                      <p className="font-semibold text-slate-950">{product.serviceQuantity}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No product movement matches the current search.</p>
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
