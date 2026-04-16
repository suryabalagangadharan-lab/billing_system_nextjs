"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast-provider";

function fmt(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

const initialForm = {
  itemCode: "",
  name: "",
  sku: "",
  brandName: "",
  category: "",
  unit: "",
  alertQty: "",
  unitPrice: "",
  gstRate: "",
  costPrice: "",
  stock: "",
  description: "",
};

function Stat({ label, value, sub }) {
  return (
    <div className="border border-slate-200 rounded-sm px-5 py-4 bg-white">
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 mb-1">
        {label}
      </p>
      <p className="text-2xl font-semibold text-slate-900 tracking-tight">
        {value}
      </p>
      {sub && (
        <p className="text-xs font-mono text-slate-400 mt-0.5">{sub}</p>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-1.5 w-full border border-slate-200 rounded-sm px-3 py-2.5 text-sm font-mono text-slate-900 outline-none focus:border-slate-900 bg-white placeholder:text-slate-300 transition-colors"
      />
    </label>
  );
}

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/products", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Unable to load products.");
      setProducts(payload.products || []);
      setError("");
    } catch (e) {
      setError(e.message);
      pushToast({
        title: "Products unavailable",
        description: e.message,
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    setPage(1);
  }, [search, stockFilter]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (showForm) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showForm]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payloadBody = {
        ...form,
        stock: Number(form.stock || 0),
        alertQty: Number(form.alertQty || 0),
      };

      const res = await fetch(editingId ? `/api/products/${editingId}` : "/api/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody),
      });
      const payload = await res.json();
      if (!res.ok)
        throw new Error(payload.error || "Unable to create product.");
      setForm(initialForm);
      setEditingId(null);
      setShowForm(false);
      pushToast({
        title: editingId ? "Product updated" : "Product created",
        description: `${payload.product.name} ${editingId ? "updated" : "added"}.`,
        tone: "success",
      });
      await loadProducts();
    } catch (e) {
      setError(e.message);
      pushToast({
        title: editingId ? "Could not update product" : "Could not create product",
        description: e.message,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this product? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Unable to delete product.");

      pushToast({ title: "Product deleted", description: `${payload.deletedId}`, tone: "success" });
      await loadProducts();
    } catch (e) {
      pushToast({ title: "Delete failed", description: e.message, tone: "error" });
    }
  }

  function handleEdit(p) {
    setForm({
      itemCode: p.itemCode || "",
      name: p.name || "",
      sku: p.sku || "",
      brandName: p.brand?.name || "",
      category: p.category || "",
      unit: p.unit || "",
      alertQty: p.alertQty ?? "",
      unitPrice: p.unitPrice ?? "",
      gstRate: p.gstRate ?? "",
      costPrice: p.costPrice ?? "",
      stock: p.stock ?? "",
      description: p.description || "",
    });
    setEditingId(p.id);
    setShowForm(true);
  }

  async function handleImport(e) {
    e.preventDefault();
    if (!importFile) {
      setError("Choose an Excel file first.");
      return;
    }
    setImporting(true);
    setImportSummary(null);
    setImportErrors([]);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const res = await fetch("/api/products/import", {
        method: "POST",
        body: fd,
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Import failed.");
      setImportSummary(payload.summary || null);
      setImportErrors(payload.errors || []);
      pushToast({
        title: "Import complete",
        description: `${payload.summary?.created || 0} created, ${payload.summary?.updated || 0} updated.`,
        tone: payload.summary?.failed ? "warning" : "success",
      });
      await loadProducts();
    } catch (e) {
      setError(e.message);
      pushToast({
        title: "Import failed",
        description: e.message,
        tone: "error",
      });
    } finally {
      setImporting(false);
    }
  }

  const totalStock = products.reduce((s, p) => s + Number(p.stock || 0), 0);
  const lowStockCount = products.filter((p) => p.stock <= 5).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch =
        !q ||
        [p.name, p.sku, p.brand?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchStock =
        stockFilter === "all"
          ? true
          : stockFilter === "low"
          ? p.stock <= 5
          : p.stock === 0;
      return matchSearch && matchStock;
    });
  }, [products, search, stockFilter]);

  const totalPages = Math.ceil(visible.length / pageSize);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visible.slice(start, start + pageSize);
  }, [visible, page, pageSize]);

  const formFields = [
    ["itemCode", "Item Code"],
    ["name", "Product Name"],
    ["sku", "SKU"],
    ["brandName", "Brand"],
    ["category", "Category"],
    ["unit", "Unit (PCS, KIT)"],
    ["alertQty", "Alert Qty"],
    ["unitPrice", "Unit Price"],
    ["gstRate", "GST Rate (%)"],
    ["costPrice", "Cost Price"],
    ["stock", "Opening Stock"],
  ];

  const COL_HEADERS = [
    "Code",
    "Name / SKU",
    "Brand",
    "Category",
    "Unit",
    "Stock",
    "Alert",
    "Price",
    "Tax",
    "Actions",
  ];

  const COL_WIDTHS = ["9%", "22%", "11%", "11%", "7%", "7%", "7%", "14%", "12%", "7%"];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between border-b border-slate-200 pb-5 mb-8">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-1">
            Inventory Desk
          </p>
          <h1 className="text-xl font-semibold text-slate-900">Products</h1>
        </div>
        <button
          onClick={() => {
            setError("");
            setShowForm(true);
          }}
          className="bg-slate-900 text-white text-xs font-mono px-5 py-2.5 rounded-sm hover:bg-slate-700 transition-colors"
        >
          + Add Product
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat
          label="Catalog Items"
          value={loading ? "—" : products.length}
          sub="Sellable items"
        />
        <Stat
          label="Units on Hand"
          value={loading ? "—" : totalStock}
          sub="Combined stock"
        />
        <Stat
          label="Low Stock"
          value={loading ? "—" : lowStockCount}
          sub="Need attention"
        />
      </div>

      {lowStockCount > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-sm px-4 py-2.5 mb-6 text-xs font-mono text-amber-700">
          ⚠ {lowStockCount} product{lowStockCount !== 1 ? "s" : ""} need
          replenishment.
        </div>
      )}

      {/* ── Product Table ── */}
      <div className="border border-slate-200 rounded-sm bg-white p-5">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-900 font-semibold">
            Product List
          </p>
          <div className="flex gap-2 flex-wrap items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, SKU, brand…"
              className="border border-slate-200 rounded-sm px-3 py-2 text-xs font-mono text-slate-900 outline-none focus:border-slate-900 bg-white placeholder:text-slate-300 transition-colors"
            />
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="border border-slate-200 rounded-sm px-3 py-2 text-xs font-mono text-slate-700 outline-none focus:border-slate-900 bg-white"
            >
              <option value="all">All stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border border-slate-200 rounded-sm px-3 py-2 text-xs font-mono text-slate-700 outline-none focus:border-slate-900 bg-white"
            >
              <option value={10}>10 / page</option>
              <option value={100}>100 / page</option>
              <option value={500}>500 / page</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="w-full overflow-x-auto border border-slate-100 rounded-sm">
          <table
            className="w-full border-collapse"
            style={{ tableLayout: "fixed" }}
          >
            <colgroup>
              {COL_WIDTHS.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-slate-50">
                {COL_HEADERS.map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] text-slate-400 font-normal whitespace-nowrap overflow-hidden"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-4">
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-10 bg-slate-100 rounded-sm animate-pulse"
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : paginated.length ? (
                paginated.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    {/* Code */}
                    <td className="px-3 py-3 text-xs font-mono text-slate-600 overflow-hidden text-ellipsis whitespace-nowrap">
                      {p.itemCode || "—"}
                    </td>

                    {/* Name / SKU */}
                    <td className="px-3 py-3 overflow-hidden">
                      <p className="font-medium text-sm text-slate-900 ">
                        {p.name}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 ">
                        {p.sku || "—"}
                      </p>
                    </td>

                    {/* Brand */}
                    <td className="px-3 py-3 text-xs font-mono text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                      {p.brand?.name || "—"}
                    </td>

                    {/* Category */}
                    <td className="px-3 py-3 text-xs font-mono text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                      {p.category || "—"}
                    </td>

                    {/* Unit */}
                    <td className="px-3 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">
                      {p.unit || "—"}
                    </td>

                    {/* Stock */}
                    <td
                      className={`px-3 py-3 text-sm font-mono font-semibold whitespace-nowrap ${
                        p.stock <= p.alertQty
                          ? "text-red-600"
                          : "text-slate-700"
                      }`}
                    >
                      {p.stock}
                    </td>

                    {/* Alert */}
                    <td className="px-3 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">
                      {p.alertQty}
                    </td>

                    {/* Price */}
                    <td className="px-3 py-3 text-sm font-mono font-medium text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">
                      {fmt(p.unitPrice)}
                    </td>

                    {/* Tax */}
                    <td className="px-3 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">
                      GST {p.gstRate}%
                    </td>
                    {/* Actions */}
                    <td className="px-3 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(p)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded-sm hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="px-2 py-1 text-xs border border-rose-200 text-rose-600 rounded-sm hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-xs font-mono text-slate-400 text-center"
                  >
                    No products match current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 text-xs font-mono text-slate-600">
          <span>
            Page {page} of {totalPages || 1}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-slate-200 rounded-sm disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="px-3 py-1 border border-slate-200 rounded-sm disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ── Add Product Drawer ── */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: "rgba(0,0,0,0.30)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <div className="w-[440px] max-w-full h-full overflow-y-auto bg-white flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 sticky top-0 bg-white z-10">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-0.5">
                  Inventory Desk
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {editingId ? "Edit Product" : "Add Product"}
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-sm text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-colors text-base"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form
              className="flex-1 px-6 py-5 space-y-3"
              onSubmit={handleSubmit}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Item Code"
                  value={form.itemCode}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, itemCode: e.target.value }))
                  }
                  placeholder="ITM-001"
                />
                <Field
                  label="SKU"
                  value={form.sku}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, sku: e.target.value }))
                  }
                  placeholder="ABC-XYZ"
                />
              </div>

              <Field
                label="Product Name"
                value={form.name}
                onChange={(e) =>
                  setForm((c) => ({ ...c, name: e.target.value }))
                }
                placeholder="Product name"
              />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Brand"
                  value={form.brandName}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, brandName: e.target.value }))
                  }
                  placeholder="Brand name"
                />
                <Field
                  label="Category"
                  value={form.category}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, category: e.target.value }))
                  }
                  placeholder="Category"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Unit"
                  value={form.unit}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, unit: e.target.value }))
                  }
                  placeholder="PCS, KIT…"
                />
                <Field
                  label="Alert Qty"
                  type="number"
                  value={form.alertQty}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, alertQty: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Unit Price"
                  type="number"
                  value={form.unitPrice}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, unitPrice: e.target.value }))
                  }
                  placeholder="0.00"
                />
                <Field
                  label="GST Rate (%)"
                  type="number"
                  value={form.gstRate}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, gstRate: e.target.value }))
                  }
                  placeholder="18"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Cost Price"
                  type="number"
                  value={form.costPrice}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, costPrice: e.target.value }))
                  }
                  placeholder="0.00"
                />
                <Field
                  label="Opening Stock"
                  type="number"
                  value={form.stock}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, stock: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>

              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500">
                  Description
                </span>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, description: e.target.value }))
                  }
                  placeholder="Short product details"
                  className="mt-1.5 w-full border border-slate-200 rounded-sm px-3 py-2.5 text-sm font-mono text-slate-900 outline-none focus:border-slate-900 bg-white placeholder:text-slate-300 transition-colors min-h-20 resize-none"
                />
              </label>

              {error && (
                <p className="text-xs font-mono text-rose-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-slate-900 text-white text-xs font-mono py-3 rounded-sm hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {saving ? "saving..." : editingId ? "save changes →" : "create product →"}
              </button>
            </form>

            {/* Import Section */}
            <div className="px-6 pb-8 border-t border-slate-100 pt-5">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-900 font-semibold mb-3">
                Import from Excel
              </p>
              <form onSubmit={handleImport} className="space-y-3">
                <label className="block">
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500">
                    Excel file (.xlsx)
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) =>
                      setImportFile(e.target.files?.[0] || null)
                    }
                    className="mt-1.5 w-full border border-slate-200 rounded-sm px-3 py-2 text-xs font-mono text-slate-700 bg-white file:mr-3 file:bg-slate-100 file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-mono file:rounded-sm file:text-slate-700 outline-none"
                  />
                </label>

                {importSummary && (
                  <p className="text-xs font-mono text-slate-500">
                    {importSummary.totalRows} rows — {importSummary.created}{" "}
                    created, {importSummary.updated} updated,{" "}
                    {importSummary.failed} failed.
                  </p>
                )}

                {importErrors.length > 0 && (
                  <div className="border border-amber-200 bg-amber-50 rounded-sm px-3 py-2 text-xs font-mono text-amber-700 space-y-0.5">
                    {importErrors.slice(0, 5).map((item) => (
                      <p key={`${item.row}-${item.message}`}>
                        row {item.row}: {item.message}
                      </p>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={importing}
                  className="w-full border border-slate-900 text-slate-900 text-xs font-mono py-3 rounded-sm hover:bg-slate-900 hover:text-white transition-colors disabled:opacity-50"
                >
                  {importing ? "importing..." : "import excel →"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}