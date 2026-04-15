"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const initialForm = {
  name: "",
  sku: "",
  brandName: "",
  unitPrice: "",
  gstRate: "",
  costPrice: "",
  stock: "",
  description: "",
};

export default function ProductsClient() {
  const { pushToast } = useToast();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [importErrors, setImportErrors] = useState([]);
  const [error, setError] = useState("");

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/products", {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load products.");
      }

      setProducts(payload.products || []);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to load products.");
      pushToast({
        title: "Products unavailable",
        description: loadError.message || "Unable to load products.",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          stock: form.stock || 0,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to create product.");
      }

      setForm(initialForm);
      pushToast({
        title: "Product created",
        description: `${payload.product.name} is ready for billing and service.`,
        tone: "success",
      });
      await loadProducts();
    } catch (submitError) {
      setError(submitError.message || "Unable to create product.");
      pushToast({
        title: "Could not create product",
        description: submitError.message || "Unable to create product.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleImport(event) {
    event.preventDefault();

    if (!importFile) {
      setError("Choose an Excel file before importing.");
      return;
    }

    setImporting(true);
    setError("");
    setImportSummary(null);
    setImportErrors([]);

    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await fetch("/api/products/import", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to import products.");
      }

      setImportSummary(payload.summary || null);
      setImportErrors(payload.errors || []);
      pushToast({
        title: "Import complete",
        description: `${payload.summary?.created || 0} created, ${payload.summary?.updated || 0} updated, ${payload.summary?.failed || 0} failed.`,
        tone: payload.summary?.failed ? "warning" : "success",
      });
      await loadProducts();
    } catch (importError) {
      setError(importError.message || "Unable to import products.");
      pushToast({
        title: "Import failed",
        description: importError.message || "Unable to import products.",
        tone: "error",
      });
    } finally {
      setImporting(false);
    }
  }

  const totalStock = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const lowStockCount = products.filter((product) => product.stock <= 5).length;
  const visibleProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch = !normalizedSearch
        ? true
        : [product.name, product.sku, product.brand?.name]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch);

      const matchesStock =
        stockFilter === "all"
          ? true
          : stockFilter === "low"
            ? product.stock <= 5
            : product.stock === 0;

      return matchesSearch && matchesStock;
    });
  }, [products, search, stockFilter]);

  return (
    <AppShell
      eyebrow="Inventory Desk"
      title="Products"
      description="Maintain the catalog, add new stockkeeping units, and keep the counter team synced on prices and availability."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Catalog Items" value={loading ? "..." : products.length} hint="Sellable items in system" tone="cyan" />
        <StatCard label="Units on Hand" value={loading ? "..." : totalStock} hint="Combined stock across catalog" />
        <StatCard label="Low Stock Items" value={loading ? "..." : lowStockCount} hint="Attention needed soon" tone="amber" />
      </div>

      {lowStockCount > 0 ? (
        <AlertBanner
          title="Low stock alert"
          description={`${lowStockCount} product${lowStockCount === 1 ? "" : "s"} need replenishment soon.`}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel>
          <SectionHeading
            title="Add Product"
            description="Create a new billable item and make it available instantly to billing and service."
          />
          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            {[
              ["name", "Product name"],
              ["sku", "SKU"],
              ["brandName", "Brand"],
              ["unitPrice", "Unit price"],
              ["gstRate", "GST rate (%)"],
              ["costPrice", "Cost price"],
              ["stock", "Opening stock"],
            ].map(([field, label]) => (
              <label key={field} className="block">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <input
                  value={form[field]}
                  onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                  placeholder={label}
                />
              </label>
            ))}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                className="mt-2 min-h-28 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                placeholder="Short product details"
              />
            </label>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Create Product"}
            </button>
          </form>

          <form className="mt-8 border-t border-slate-200 pt-6" onSubmit={handleImport}>
            <SectionHeading
              title="Import From Excel"
              description="Upload stock sheet to create or update products in bulk."
            />
            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">Excel file (.xlsx)</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
              />
            </label>
            {importSummary ? (
              <p className="mt-3 text-sm text-slate-600">
                Imported {importSummary.totalRows} row(s): {importSummary.created} created, {importSummary.updated} updated, {importSummary.skipped || 0} skipped, {importSummary.failed} failed.
              </p>
            ) : null}
            {importErrors.length ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {importErrors.slice(0, 5).map((item) => (
                  <p key={`${item.row}-${item.message}`}>
                    Row {item.row}: {item.message}
                  </p>
                ))}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={importing}
              className="mt-4 w-full rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
            >
              {importing ? "Importing..." : "Import Excel"}
            </button>
          </form>
        </Panel>

        <Panel>
          <SectionHeading
            title="Product List"
            description="Live catalog overview for pricing, stock, and quick operational checks."
            action={
              <div className="flex flex-wrap gap-3">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-cyan-500"
                  placeholder="Search products"
                />
                <select
                  value={stockFilter}
                  onChange={(event) => setStockFilter(event.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-cyan-500"
                >
                  <option value="all">All stock</option>
                  <option value="low">Low stock</option>
                  <option value="out">Out of stock</option>
                </select>
              </div>
            }
          />
          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-200">
            <div className="grid grid-cols-[1.4fr_1fr_0.7fr_0.8fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span>Product</span>
              <span>Brand</span>
              <span>Stock</span>
              <span>Price</span>
            </div>
            <div className="divide-y divide-slate-200">
              {loading ? (
                <div className="grid gap-4 p-4">
                  <LoadingCard lines={2} />
                  <LoadingCard lines={2} />
                </div>
              ) : visibleProducts.length ? (
                visibleProducts.map((product) => (
                  <div
                    key={product.id}
                    className="grid grid-cols-[1.4fr_1fr_0.7fr_0.8fr] gap-3 px-4 py-4 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-950">{product.name}</p>
                      <p className="text-slate-500">{product.sku || "No SKU"}</p>
                    </div>
                    <p className="text-slate-600">{product.brand?.name || "Unbranded"}</p>
                    <p className={product.stock <= 5 ? "font-semibold text-amber-600" : "text-slate-700"}>
                      {product.stock}
                    </p>
                    <p className="font-medium text-slate-950">{formatCurrency(product.unitPrice)}</p>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-sm text-slate-500">
                  No products match the current filters.
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
