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

function Select({ children, className = "", ...props }) {
  return (
    <select
      className={`w-full border border-slate-200 rounded-lg bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-slate-400 transition-colors ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </label>
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

function StockBadge({ stock, alertQty }) {
  if (stock === 0)
    return (
      <span className="text-[12px] font-medium px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">
        Out
      </span>
    );
  if (stock <= alertQty)
    return (
      <span className="text-[12px] font-medium px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
        Low
      </span>
    );
  return (
    <span className="text-[12px] font-medium px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
      OK
    </span>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ProductsClient() {
  const { pushToast } = useToast();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
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
  const [gstCategory, setGstCategory] = useState("");
  const [gstValue, setGstValue] = useState("");
  const [updatingGst, setUpdatingGst] = useState(false);
  const [showGstPanel, setShowGstPanel] = useState(false);
  const [activeTab, setActiveTab] = useState("details"); // "details" | "import"

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
      pushToast({ title: "Products unavailable", description: e.message, tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { setPage(1); }, [search, stockFilter, categoryFilter]);
  useEffect(() => {
    document.body.style.overflow = showForm ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showForm]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(
        editingId ? `/api/products/${editingId}` : "/api/products",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, stock: Number(form.stock || 0), alertQty: Number(form.alertQty || 0) }),
        }
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Unable to save product.");
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
      pushToast({ title: "Could not save product", description: e.message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Unable to delete product.");
      pushToast({ title: "Product deleted", description: name, tone: "success" });
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
    setActiveTab("details");
    setShowForm(true);
  }

  async function handleImport(e) {
    e.preventDefault();
    if (!importFile) return setError("Choose an Excel file first.");
    setImporting(true);
    setImportSummary(null);
    setImportErrors([]);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const res = await fetch("/api/products/import", { method: "POST", body: fd });
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
      pushToast({ title: "Import failed", description: e.message, tone: "error" });
    } finally {
      setImporting(false);
    }
  }

  async function handleUpdateGst() {
    if (!gstCategory || !gstValue) return pushToast({ title: "Select category and GST value", tone: "error" });
    if (!confirm(`Update GST to ${gstValue}% for all products in "${gstCategory}"?`)) return;
    try {
      setUpdatingGst(true);
      const res = await fetch("/api/products/update-gst-by-category", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: gstCategory, gstRate: gstValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      pushToast({ title: "GST updated", description: `${data.updatedCount} products updated.`, tone: "success" });
      setGstCategory("");
      setGstValue("");
      setShowGstPanel(false);
      await loadProducts();
    } catch (err) {
      pushToast({ title: "GST update failed", description: err.message, tone: "error" });
    } finally {
      setUpdatingGst(false);
    }
  }

  const totalStock = products.reduce((s, p) => s + Number(p.stock || 0), 0);
  const lowStockCount = products.filter((p) => p.stock <= p.alertQty && p.stock > 0).length;
  const outStockCount = products.filter((p) => p.stock === 0).length;

  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch = !q || [p.name, p.sku, p.brand?.name, p.category, p.itemCode].filter(Boolean).join(" ").toLowerCase().includes(q);
      const matchStock = stockFilter === "all" ? true : stockFilter === "low" ? (p.stock <= p.alertQty && p.stock > 0) : p.stock === 0;
      const matchCategory = categoryFilter === "all" ? true : p.category === categoryFilter;
      return matchSearch && matchStock && matchCategory;
    });
  }, [products, search, stockFilter, categoryFilter]);

  const totalPages = Math.ceil(visible.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visible.slice(start, start + pageSize);
  }, [visible, page, pageSize]);

  const hasFilters = search || stockFilter !== "all" || categoryFilter !== "all";

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top bar ── */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-screen-xl mx-auto px-6 h-[52px] flex items-center gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-[15px] font-medium text-slate-900">OpsHub</span>
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-[14px] font-medium text-slate-900">Products</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGstPanel((v) => !v)}
              className="text-[13px] px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Update GST ↓
            </button>
            <button
              onClick={() => { setError(""); setEditingId(null); setForm(initialForm); setActiveTab("details"); setShowForm(true); }}
              className="text-[13px] font-medium px-4 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              + Add product
            </button>
          </div>
        </div>
      </header>

      {/* ── GST Slide-down panel ── */}
      {showGstPanel && (
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-screen-xl mx-auto px-6 py-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <div className="flex items-end gap-4 flex-wrap">
                <div className="flex-1 min-w-[160px]">
                  <Label>Category</Label>
                  <Select value={gstCategory} onChange={(e) => setGstCategory(e.target.value)}>
                    <option value="">Select category…</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div className="w-32">
                  <Label>GST Rate (%)</Label>
                  <Input type="number" value={gstValue} onChange={(e) => setGstValue(e.target.value)} placeholder="18" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateGst}
                    disabled={updatingGst || !gstCategory || !gstValue}
                    className="text-[13px] font-medium px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    {updatingGst ? "Updating…" : "Apply →"}
                  </button>
                  <button
                    onClick={() => setShowGstPanel(false)}
                    className="text-[13px] px-4 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              {gstCategory && (
                <p className="text-[13px] text-slate-400 mt-3">
                  This will update GST to <span className="font-medium text-slate-700">{gstValue || "?"}%</span> for all products in <span className="font-medium text-slate-700">"{gstCategory}"</span>.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-screen-xl mx-auto px-6 pt-6 pb-2">
        <h1 className="text-[19px] font-medium text-slate-900">Product catalogue</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Manage inventory items, pricing, and stock levels.</p>
      </div>

      {/* ── Stats ── */}
      <div className="max-w-screen-xl mx-auto px-6 pt-4 pb-2">
        <div className="grid grid-cols-4 bg-white border border-slate-200 rounded-xl overflow-hidden divide-x divide-slate-100">
          {[
            { label: "Catalog Items", value: loading ? "—" : products.length, sub: "Total products" },
            { label: "Units on Hand", value: loading ? "—" : totalStock.toLocaleString("en-IN"), sub: "Combined stock" },
            { label: "Low Stock", value: loading ? "—" : lowStockCount, sub: "Need replenishment", warn: lowStockCount > 0 },
            { label: "Out of Stock", value: loading ? "—" : outStockCount, sub: "Zero quantity", dark: outStockCount > 0 },
          ].map(({ label, value, sub, dark, warn }) => (
            <div key={label} className={`px-5 py-4 ${dark ? "bg-slate-900" : warn ? "bg-amber-50" : ""}`}>
              <p className={`text-[13px] font-medium tracking-wide uppercase mb-1 ${dark ? "text-slate-400" : warn ? "text-amber-600" : "text-slate-400"}`}>{label}</p>
              <p className={`text-[20px] font-medium ${dark ? "text-white" : warn ? "text-amber-700" : "text-slate-900"}`}>{value}</p>
              <p className={`text-[12px] mt-0.5 ${dark ? "text-slate-500" : warn ? "text-amber-500" : "text-slate-400"}`}>{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Low stock alert ── */}
      {lowStockCount > 0 && (
        <div className="max-w-screen-xl mx-auto px-6 pt-3">
          <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 text-[13px] text-amber-700 flex items-center gap-2">
            <span>⚠</span>
            <span><span className="font-medium">{lowStockCount} product{lowStockCount !== 1 ? "s" : ""}</span> are running low and need replenishment.</span>
            <button
              onClick={() => setStockFilter("low")}
              className="ml-auto text-[13px] font-medium text-amber-700 underline underline-offset-2"
            >
              View low stock →
            </button>
          </div>
        </div>
      )}

      {/* ── Main table card ── */}
      <div className="max-w-screen-xl mx-auto px-6 pb-8 pt-4">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 select-none pointer-events-none text-[14px]">⌕</span>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, SKU, brand, code…"
                className="pl-8"
              />
            </div>
            <div className="w-44">
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="w-36">
              <Select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
                <option value="all">All stock</option>
                <option value="low">Low stock</option>
                <option value="out">Out of stock</option>
              </Select>
            </div>
            <div className="w-32">
              <Select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={500}>500 / page</option>
              </Select>
            </div>
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setStockFilter("all"); setCategoryFilter("all"); }}
                className="text-[13px] text-slate-400 hover:text-slate-700 transition-colors whitespace-nowrap"
              >
                Clear ✕
              </button>
            )}
            <span className="text-[13px] text-slate-400 ml-auto whitespace-nowrap">
              {visible.length} result{visible.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "10%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "9%" }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Code", "Name / SKU", "Brand", "Category", "Unit", "Stock", "Status", "Price", "Tax", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[12px] font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap overflow-hidden">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded-lg animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginated.length ? (
                  paginated.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-3 text-[13px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap font-mono">
                        {p.itemCode || "—"}
                      </td>
                      <td className="px-4 py-3 overflow-hidden">
                        <p className="text-[14px] font-medium text-slate-900 truncate">{p.name}</p>
                        <p className="text-[12px] text-slate-400 font-mono">{p.sku || "No SKU"}</p>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                        {p.brand?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                        {p.category || "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-500 whitespace-nowrap">
                        {p.unit || "—"}
                      </td>
                      <td className={`px-4 py-3 text-[14px] font-medium whitespace-nowrap ${p.stock === 0 ? "text-red-500" : p.stock <= p.alertQty ? "text-amber-600" : "text-slate-900"}`}>
                        {p.stock}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StockBadge stock={p.stock} alertQty={p.alertQty} />
                      </td>
                      <td className="px-4 py-3 text-[14px] font-medium text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">
                        {fmt(p.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-500 whitespace-nowrap">
                        {p.gstRate}%
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleEdit(p)}
                            className="text-[13px] font-medium px-2.5 py-1 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="text-[13px] px-2.5 py-1 border border-red-100 rounded-lg text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <p className="text-[14px] text-slate-300 mb-3">No products match current filters.</p>
                      {hasFilters && (
                        <button
                          onClick={() => { setSearch(""); setStockFilter("all"); setCategoryFilter("all"); }}
                          className="text-[13px] px-4 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100">
            <span className="text-[13px] text-slate-400">
              Page {page} of {totalPages} · {visible.length} result{visible.length !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="text-[13px] px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="text-[13px] px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add / Edit Drawer ── */}
      {showForm && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          />

          {/* Drawer */}
          <div className="fixed right-0 top-0 bottom-0 z-50 w-[460px] max-w-full bg-white border-l border-slate-200 flex flex-col shadow-2xl">

            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div>
                <p className="text-[13px] text-slate-400 mb-0.5">Inventory · Products</p>
                <p className="text-[17px] font-medium text-slate-900">
                  {editingId ? "Edit product" : "Add product"}
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-[13px] px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
              >
                ✕ Close
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-slate-100 shrink-0 px-5">
              {["details", "import"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-[13px] font-medium py-3 mr-5 border-b-2 transition-colors capitalize ${
                    activeTab === tab
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {tab === "details" ? "Product details" : "Import Excel"}
                </button>
              ))}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto bg-slate-50">

              {activeTab === "details" && (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <CardHeader title="Identity" subtitle="Codes, name and brand" />
                    <div className="p-5 flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Item Code" value={form.itemCode} onChange={(e) => setForm((c) => ({ ...c, itemCode: e.target.value }))} placeholder="ITM-001" />
                        <Field label="SKU" value={form.sku} onChange={(e) => setForm((c) => ({ ...c, sku: e.target.value }))} placeholder="ABC-XYZ" />
                      </div>
                      <Field label="Product Name *" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="Product name" />
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Brand" value={form.brandName} onChange={(e) => setForm((c) => ({ ...c, brandName: e.target.value }))} placeholder="Brand name" />
                        <Field label="Category" value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))} placeholder="Category" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <CardHeader title="Pricing & Tax" subtitle="Selling price, cost price and GST" />
                    <div className="p-5 flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Unit Price" type="number" value={form.unitPrice} onChange={(e) => setForm((c) => ({ ...c, unitPrice: e.target.value }))} placeholder="0.00" />
                        <Field label="Cost Price" type="number" value={form.costPrice} onChange={(e) => setForm((c) => ({ ...c, costPrice: e.target.value }))} placeholder="0.00" />
                      </div>
                      <Field label="GST Rate (%)" type="number" value={form.gstRate} onChange={(e) => setForm((c) => ({ ...c, gstRate: e.target.value }))} placeholder="18" />
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <CardHeader title="Stock & Unit" subtitle="Quantity, unit and alert threshold" />
                    <div className="p-5 flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Opening Stock" type="number" value={form.stock} onChange={(e) => setForm((c) => ({ ...c, stock: e.target.value }))} placeholder="0" />
                        <Field label="Alert Qty" type="number" value={form.alertQty} onChange={(e) => setForm((c) => ({ ...c, alertQty: e.target.value }))} placeholder="5" />
                      </div>
                      <Field label="Unit (PCS, KIT…)" value={form.unit} onChange={(e) => setForm((c) => ({ ...c, unit: e.target.value }))} placeholder="PCS" />
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <CardHeader title="Description" subtitle="Optional product notes" />
                    <div className="p-5">
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                        placeholder="Short product details, specs, notes…"
                        rows={3}
                        className="w-full border border-slate-200 rounded-lg bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-slate-400 transition-colors placeholder:text-slate-300 resize-none"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="border border-red-100 bg-red-50 rounded-xl px-4 py-3 text-[13px] text-red-600">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 text-[13px] font-medium py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      {saving ? "Saving…" : editingId ? "Save changes →" : "Create product →"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="text-[13px] px-4 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {activeTab === "import" && (
                <form onSubmit={handleImport} className="flex flex-col gap-4 p-5">
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <CardHeader title="Import from Excel" subtitle="Upload .xlsx to bulk create or update products" />
                    <div className="p-5 flex flex-col gap-4">
                      <div>
                        <Label>Excel file (.xlsx)</Label>
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 bg-white file:mr-3 file:bg-slate-100 file:border-0 file:px-3 file:py-1.5 file:text-[13px] file:rounded-lg file:text-slate-700 outline-none"
                        />
                      </div>

                      {importSummary && (
                        <div className="border border-emerald-200 bg-emerald-50 rounded-xl px-4 py-3 text-[13px] text-emerald-700">
                          <p className="font-medium mb-0.5">Import complete</p>
                          <p>{importSummary.totalRows} rows · {importSummary.created} created · {importSummary.updated} updated · {importSummary.failed} failed</p>
                        </div>
                      )}

                      {importErrors.length > 0 && (
                        <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 text-[13px] text-amber-700 space-y-1">
                          <p className="font-medium">Row errors</p>
                          {importErrors.slice(0, 5).map((item) => (
                            <p key={`${item.row}-${item.message}`}>Row {item.row}: {item.message}</p>
                          ))}
                          {importErrors.length > 5 && <p>…and {importErrors.length - 5} more</p>}
                        </div>
                      )}

                      {error && (
                        <div className="border border-red-100 bg-red-50 rounded-xl px-4 py-3 text-[13px] text-red-600">
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={importing || !importFile}
                        className="text-[13px] font-medium py-2.5 border border-slate-900 text-slate-900 rounded-lg hover:bg-slate-900 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {importing ? "Importing…" : "Import Excel →"}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <p className="text-[14px] font-medium text-slate-900 mb-2">Expected columns</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["itemCode", "name", "sku", "brand", "category", "unit", "unitPrice", "costPrice", "gstRate", "stock", "alertQty"].map((col) => (
                        <span key={col} className="text-[12px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">{col}</span>
                      ))}
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}