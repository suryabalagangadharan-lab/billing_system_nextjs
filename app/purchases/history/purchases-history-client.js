"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast-provider";

const warehouses = ["Main Warehouse", "Service Counter", "Spare Stock Room"];
const defaultFilters = { search: "", supplier: "", from: "", to: "" };

function fmt(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function isoDate(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

function num(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calcItem(item) {
  const quantity = Math.max(1, Number(item.quantity || 0));
  const purchasePrice = num(item.purchasePrice);
  const discountAmount = num(item.discountAmount);
  const gstRate = num(item.gstRate);
  const taxable = Math.max(purchasePrice - discountAmount, 0);
  const taxAmount = taxable * (gstRate / 100);
  const unitCost = taxable + taxAmount;
  const totalAmount = unitCost * quantity;
  return { ...item, quantity, purchasePrice, discountAmount, gstRate, taxAmount, unitCost, totalAmount };
}

function deriveGstRate(purchase) {
  const base = Math.max(Number(purchase.purchasePrice || 0) - Number(purchase.discountAmount || 0), 0);
  if (!base) return "0.00";
  return ((Number(purchase.taxAmount || 0) * 100) / base).toFixed(2);
}

// ── Primitives ──────────────────────────────────────────────────────────────

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

function StatusBadge({ status }) {
  const styles = {
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    partial: "bg-blue-50 text-blue-700 border-blue-200",
    unpaid: "bg-red-50 text-red-600 border-red-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span
      className={`text-[13px] font-medium px-2 py-0.5 rounded-full border ${
        styles[status?.toLowerCase()] || styles.pending
      }`}
    >
      {status || "unknown"}
    </span>
  );
}

// ── Edit Drawer ──────────────────────────────────────────────────────────────

function EditDrawer({ purchase, products, onClose, onSaved, pushToast }) {
  const searchInputRef = useRef(null);
  const [dropdownRect, setDropdownRect] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [draft, setDraft] = useState({ quantity: "1", purchasePrice: "", discountAmount: "", gstRate: "" });

  const [editForm, setEditForm] = useState({
    warehouse: purchase.warehouse || warehouses[0],
    supplierName: purchase.supplierName || "",
    referenceNo: purchase.referenceNo || "",
    purchaseDate: isoDate(purchase.purchaseDate),
    note: purchase.note || "",
    otherCharges: String(purchase.otherCharges ?? ""),
    discountOnAll: String(purchase.discountOnAll ?? ""),
    roundOff: String(purchase.roundOff ?? ""),
  });

  const [items, setItems] = useState(
    (purchase.purchases || []).map((p) => ({
      id: p.id,
      productId: p.productId,
      name: p.product?.name || "Item",
      sku: p.product?.sku || "",
      itemCode: p.product?.itemCode || "",
      quantity: p.quantity,
      purchasePrice: p.purchasePrice,
      discountAmount: p.discountAmount,
      gstRate: deriveGstRate(p),
    }))
  );

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) =>
      [p.name, p.sku, p.itemCode, p.category, p.brand?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [products, query]);

  const lineItems = useMemo(() => items.map(calcItem), [items]);

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((s, i) => s + i.totalAmount, 0);
    const otherCharges = num(editForm.otherCharges);
    const discountOnAll = num(editForm.discountOnAll);
    const roundOff = num(editForm.roundOff);
    const grandTotal = subtotal + otherCharges - discountOnAll + roundOff;
    return {
      qty: lineItems.reduce((s, i) => s + Number(i.quantity || 0), 0),
      subtotal,
      grandTotal,
      paid: num(purchase.paidAmount),
      due: num(purchase.dueAmount),
    };
  }, [editForm, lineItems, purchase]);

  useEffect(() => {
    if (query.trim() && searchInputRef.current) {
      const rect = searchInputRef.current.getBoundingClientRect();
      setDropdownRect({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
    }
  }, [query]);

  useEffect(() => {
    const update = () => {
      if (query.trim() && searchInputRef.current) {
        const rect = searchInputRef.current.getBoundingClientRect();
        setDropdownRect({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
      }
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [query]);

  function chooseProduct(p) {
    setSelectedProduct(p);
    setQuery(p.name || "");
    setDropdownRect(null);
    setDraft({
      quantity: "1",
      purchasePrice: p.costPrice ?? p.unitPrice ?? "0.00",
      discountAmount: "0.00",
      gstRate: p.gstRate ?? "0.00",
    });
  }

  function addItem() {
    if (!selectedProduct) return setError("Choose a product first.");
    const quantity = Number(draft.quantity || 0);
    if (!Number.isInteger(quantity) || quantity <= 0) return setError("Quantity must be a positive whole number.");
    const item = {
      id: crypto.randomUUID(),
      productId: selectedProduct.id,
      name: selectedProduct.name,
      sku: selectedProduct.sku || "",
      itemCode: selectedProduct.itemCode || "",
      quantity,
      purchasePrice: draft.purchasePrice,
      discountAmount: draft.discountAmount,
      gstRate: draft.gstRate,
    };
    setItems((cur) => {
      const idx = cur.findIndex((l) => l.productId === item.productId);
      if (idx >= 0) {
        const next = [...cur];
        next[idx] = { ...next[idx], quantity: Number(next[idx].quantity || 0) + quantity };
        return next;
      }
      return [...cur, item];
    });
    setSelectedProduct(null);
    setQuery("");
    setDropdownRect(null);
    setDraft({ quantity: "1", purchasePrice: "", discountAmount: "", gstRate: "" });
    setError("");
  }

  function updateItem(productId, key, value) {
    setItems((cur) => cur.map((i) => (i.productId === productId ? { ...i, [key]: value } : i)));
  }

  function removeItem(productId) {
    setItems((cur) => cur.filter((i) => i.productId !== productId));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!editForm.supplierName.trim()) return setError("Supplier name is required.");
    if (!items.length) return setError("Add at least one item.");
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...editForm,
        otherCharges: num(editForm.otherCharges),
        discountOnAll: num(editForm.discountOnAll),
        roundOff: num(editForm.roundOff),
        items: lineItems.map((i) => ({
          id: i.id,
          productId: i.productId,
          quantity: i.quantity,
          purchasePrice: i.purchasePrice,
          discountAmount: i.discountAmount,
          gstRate: i.gstRate,
        })),
      };
      const res = await fetch(`/api/purchases/${purchase.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to update purchase.");
      pushToast({ title: "Purchase updated", description: "Changes saved successfully.", tone: "success" });
      onSaved(data.purchaseGroup);
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Update failed", description: e.message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Product dropdown portal */}
      {query.trim() && filteredProducts.length > 0 && dropdownRect && (
        <div
          className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
          style={{ top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
        >
          {filteredProducts.slice(0, 8).map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                chooseProduct(p);
              }}
              className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
            >
              <span>
                <span className="block text-[14px] font-medium text-slate-900">{p.name}</span>
                <span className="block text-[13px] text-slate-400">
                  {p.itemCode || p.sku || "—"}
                  {p.brand?.name ? ` · ${p.brand.name}` : ""}
                </span>
              </span>
              <span className="text-[13px] text-slate-400 whitespace-nowrap">{p.stock ?? 0} in stock</span>
            </button>
          ))}
        </div>
      )}

      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-3xl bg-white border-l border-slate-200 flex flex-col shadow-2xl overflow-hidden">

        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0 bg-white">
          <div>
            <p className="text-[13px] text-slate-400 mb-0.5">Editing Purchase</p>
            <p className="text-[17px] font-medium text-slate-900">{purchase.groupCode}</p>
            <p className="text-[13px] text-slate-400">{purchase.supplierName} · {purchase.warehouse}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/purchases/${purchase.id}/export`}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors no-underline"
            >
              Download bill ↗
            </a>
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 shrink-0 bg-slate-50">
          {[
            { label: "Grand Total", value: fmt(purchase.grandTotal) },
            { label: "Paid", value: fmt(totals.paid) },
            { label: "Due", value: fmt(totals.due), dark: totals.due > 0 },
            { label: "Items", value: lineItems.length },
          ].map(({ label, value, dark }) => (
            <div key={label} className={`px-4 py-3 ${dark ? "bg-slate-900" : ""}`}>
              <p className={`text-[13px] font-medium tracking-wide uppercase mb-1 ${dark ? "text-slate-400" : "text-slate-400"}`}>{label}</p>
              <p className={`text-[14px] font-medium ${dark ? "text-white" : "text-slate-900"}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <form onSubmit={handleSave} className="flex flex-col gap-4 p-5">

            {/* Section 1: Order details */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <CardHeader title="Order details" subtitle="Warehouse, supplier, reference & date" />
              <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <Label>Warehouse</Label>
                  <Select value={editForm.warehouse} onChange={(e) => setEditForm((c) => ({ ...c, warehouse: e.target.value }))}>
                    {warehouses.map((w) => <option key={w}>{w}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Supplier *</Label>
                  <Input value={editForm.supplierName} onChange={(e) => setEditForm((c) => ({ ...c, supplierName: e.target.value }))} placeholder="Supplier name" />
                </div>
                <div>
                  <Label>Reference No.</Label>
                  <Input value={editForm.referenceNo} onChange={(e) => setEditForm((c) => ({ ...c, referenceNo: e.target.value }))} placeholder="Bill / GRN" />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={editForm.purchaseDate} onChange={(e) => setEditForm((c) => ({ ...c, purchaseDate: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Section 2: Add product */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <CardHeader title="Add / Replace product" subtitle="Search by name, SKU, item code" />
              <div className="p-5">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      ref={searchInputRef}
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setSelectedProduct(null); }}
                      onBlur={() => setTimeout(() => setDropdownRect(null), 150)}
                      placeholder="Search by name, SKU, item code..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    disabled={!selectedProduct}
                    className="text-[13px] font-medium px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    + Add item
                  </button>
                </div>

                {selectedProduct && (
                  <div className="mt-4 border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[14px] font-medium text-slate-900">{selectedProduct.name}</p>
                        <p className="text-[13px] text-slate-400">{selectedProduct.itemCode || selectedProduct.sku || "No code"}</p>
                      </div>
                      <span className="text-[12px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">Selected</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { key: "quantity", label: "Qty" },
                        { key: "purchasePrice", label: "Price" },
                        { key: "discountAmount", label: "Discount (₹)" },
                        { key: "gstRate", label: "GST (%)" },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <Label>{label}</Label>
                          <Input type="number" value={draft[key]} onChange={(e) => setDraft((c) => ({ ...c, [key]: e.target.value }))} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Line items */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <CardHeader
                title="Line items"
                subtitle={`${lineItems.length} product${lineItems.length !== 1 ? "s" : ""} · ${totals.qty} units`}
              />
              {lineItems.length === 0 ? (
                <div className="p-5">
                  <div className="border border-dashed border-slate-200 rounded-xl py-8 text-center">
                    <p className="text-[14px] text-slate-300">No items loaded</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div
                    className="grid px-5 py-2.5 bg-slate-50 border-b border-slate-100"
                    style={{ gridTemplateColumns: "2fr 64px 100px 90px 90px 100px 100px 32px" }}
                  >
                    {["Item", "Qty", "Cost Price", "Discount", "Tax Amt", "Unit Cost", "Total", ""].map((h) => (
                      <span key={h} className="text-[12px] font-medium text-slate-400 uppercase tracking-wide">{h}</span>
                    ))}
                  </div>
                  {lineItems.map((item) => {
                    const calc = calcItem(item);
                    return (
                      <div
                        key={item.id}
                        className="grid items-center px-5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                        style={{ gridTemplateColumns: "2fr 64px 100px 90px 90px 100px 100px 32px" }}
                      >
                        <div>
                          <p className="text-[14px] font-medium text-slate-900 truncate max-w-[150px]">{item.name}</p>
                          <p className="text-[12px] text-slate-400">{item.itemCode || item.sku || "—"}</p>
                        </div>
                        <input type="number" value={item.quantity} onChange={(e) => updateItem(item.productId, "quantity", e.target.value)} className="w-14 border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] text-slate-900 outline-none focus:border-slate-400" />
                        <input type="number" value={item.purchasePrice} onChange={(e) => updateItem(item.productId, "purchasePrice", e.target.value)} className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] text-slate-900 outline-none focus:border-slate-400" />
                        <input type="number" value={item.discountAmount} onChange={(e) => updateItem(item.productId, "discountAmount", e.target.value)} className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] text-slate-900 outline-none focus:border-slate-400" />
                        <span className="text-[13px] text-slate-500">{fmt(calc.taxAmount)}</span>
                        <span className="text-[13px] text-slate-500">{fmt(calc.unitCost)}</span>
                        <span className="text-[13px] font-medium text-slate-900">{fmt(calc.totalAmount)}</span>
                        <button type="button" onClick={() => removeItem(item.productId)} className="text-slate-300 hover:text-red-500 transition-colors text-[14px]">✕</button>
                      </div>
                    );
                  })}
                  <div className="grid grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
                    {[
                      { label: "Total Qty", value: totals.qty },
                      { label: "Subtotal", value: fmt(totals.subtotal) },
                      { label: "Grand Total", value: fmt(totals.grandTotal) },
                      { label: "Due", value: fmt(totals.due), dark: true },
                    ].map(({ label, value, dark }) => (
                      <div key={label} className={`px-5 py-3 ${dark ? "bg-slate-900" : ""}`}>
                        <p className={`text-[13px] font-medium tracking-wide uppercase mb-1 ${dark ? "text-slate-400" : "text-slate-400"}`}>{label}</p>
                        <p className={`text-[14px] font-medium ${dark ? "text-white" : "text-slate-900"}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Adjustments */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <CardHeader title="Adjustments & save" subtitle="Additional charges, discounts, round off, notes" />
              <div className="p-5 flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { key: "otherCharges", label: "Other Charges (₹)" },
                    { key: "discountOnAll", label: "Discount on All (₹)" },
                    { key: "roundOff", label: "Round Off (₹)" },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <Label>{label}</Label>
                      <Input type="number" value={editForm[key]} onChange={(e) => setEditForm((c) => ({ ...c, [key]: e.target.value }))} placeholder="0.00" />
                    </div>
                  ))}
                </div>
                <div>
                  <Label>Note</Label>
                  <textarea
                    rows={3}
                    value={editForm.note}
                    onChange={(e) => setEditForm((c) => ({ ...c, note: e.target.value }))}
                    placeholder="Internal remark, delivery note..."
                    className="w-full border border-slate-200 rounded-lg bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-slate-400 transition-colors placeholder:text-slate-300 resize-none"
                  />
                </div>
                {error && (
                  <div className="border border-red-100 bg-red-50 rounded-lg px-4 py-2.5 text-[13px] text-red-600">
                    {error}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="text-[13px] font-medium px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving..." : "Save changes →"}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-[13px] px-4 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function PurchasesHistoryClient() {
  const { pushToast } = useToast();
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState("");

  const historyExportUrl = `/api/purchases/export?search=${encodeURIComponent(filters.search)}&supplier=${encodeURIComponent(filters.supplier)}&from=${encodeURIComponent(filters.from)}&to=${encodeURIComponent(filters.to)}`;

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [pRes, purRes] = await Promise.all([
          fetch("/api/products", { cache: "no-store" }),
          fetch(
            `/api/purchases?take=200&search=${encodeURIComponent(filters.search)}&supplier=${encodeURIComponent(filters.supplier)}&from=${encodeURIComponent(filters.from)}&to=${encodeURIComponent(filters.to)}`,
            { cache: "no-store" }
          ),
        ]);
        const pData = await pRes.json();
        const purData = await purRes.json();
        if (!active) return;
        if (!pRes.ok) throw new Error(pData.error || "Unable to load products.");
        if (!purRes.ok) throw new Error(purData.error || "Unable to load purchases.");
        setProducts(pData.products || []);
        setPurchases(purData.purchaseGroups || []);
      } catch (e) {
        if (!active) return;
        setError(e.message);
        pushToast({ title: "Load failed", description: e.message, tone: "error" });
      } finally {
        if (active) setLoading(false);
      }
    }
    const t = setTimeout(load, 250);
    return () => { active = false; clearTimeout(t); };
  }, [filters.from, filters.search, filters.supplier, filters.to, pushToast]);

  async function openEdit(id) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/purchases/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load purchase.");
      setEditingPurchase(data.purchaseGroup);
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Could not load purchase", description: e.message, tone: "error" });
    } finally {
      setLoadingId(null);
    }
  }

  function handleSaved(updated) {
    setPurchases((cur) => cur.map((p) => (p.id === updated.id ? updated : p)));
    setEditingPurchase(null);
  }

  const stats = useMemo(() => {
    const total = purchases.reduce((s, p) => s + num(p.grandTotal), 0);
    const paid = purchases.reduce((s, p) => s + num(p.paidAmount), 0);
    const due = purchases.reduce((s, p) => s + num(p.dueAmount), 0);
    return { count: purchases.length, total, paid, due };
  }, [purchases]);

  const hasFilters = filters.search || filters.supplier || filters.from || filters.to;

  if (loading && purchases.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-[14px] text-slate-400">Loading purchases...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Edit drawer */}
      {editingPurchase && (
        <EditDrawer
          purchase={editingPurchase}
          products={products}
          onClose={() => setEditingPurchase(null)}
          onSaved={handleSaved}
          pushToast={pushToast}
        />
      )}

      {/* ── Top bar ── */}
      <header className="bg-white border-b border-slate-200 z-20">
        <div className="max-w-screen-xl mx-auto px-6 h-[52px] flex items-center gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-[15px] font-medium text-slate-900">OpsHub</span>
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-[14px] text-slate-500">Purchases</span>
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-[14px] font-medium text-slate-900">History</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/purchases"
              className="text-[13px] px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors no-underline"
            >
              ← New purchase
            </Link>
            <a
              href={historyExportUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors no-underline"
            >
              Export Excel ↗
            </a>
          </div>
        </div>
      </header>

      {/* ── Page header ── */}
      <div className="max-w-screen-xl mx-auto px-6 pt-6 pb-2">
        <h1 className="text-[19px] font-medium text-slate-900">Purchase history</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Filter, review and edit all past purchase orders.</p>
      </div>

      {/* ── Stats bar ── */}
      <div className="max-w-screen-xl mx-auto px-6 pt-4 pb-2">
        <div className="grid grid-cols-4 bg-white border border-slate-200 rounded-xl overflow-hidden divide-x divide-slate-100">
          {[
            { label: "Records", value: stats.count },
            { label: "Total Value", value: fmt(stats.total) },
            { label: "Total Paid", value: fmt(stats.paid) },
            { label: "Outstanding Due", value: fmt(stats.due), dark: stats.due > 0 },
          ].map(({ label, value, dark }) => (
            <div key={label} className={`px-5 py-4 ${dark ? "bg-slate-900" : ""}`}>
              <p className={`text-[13px] font-medium tracking-wide uppercase mb-1 ${dark ? "text-slate-400" : "text-slate-400"}`}>{label}</p>
              <p className={`text-[17px] font-medium ${dark ? "text-white" : "text-slate-900"}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="max-w-screen-xl mx-auto px-6 pb-8 pt-4 grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4">

        {/* ── LEFT: Filters ── */}
        <div className="flex flex-col gap-4">

          {/* Filter card */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <CardHeader title="Filter records" subtitle="Narrow by date, supplier, keyword" />
            <div className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>From</Label>
                  <Input type="date" value={filters.from} onChange={(e) => setFilters((c) => ({ ...c, from: e.target.value }))} />
                </div>
                <div>
                  <Label>To</Label>
                  <Input type="date" value={filters.to} onChange={(e) => setFilters((c) => ({ ...c, to: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Supplier</Label>
                <Input value={filters.supplier} onChange={(e) => setFilters((c) => ({ ...c, supplier: e.target.value }))} placeholder="Search supplier..." />
              </div>
              <div>
                <Label>Keyword</Label>
                <Input value={filters.search} onChange={(e) => setFilters((c) => ({ ...c, search: e.target.value }))} placeholder="Code, reference, warehouse..." />
              </div>
              <button
                type="button"
                onClick={() => setFilters(defaultFilters)}
                className="w-full text-[13px] py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Clear filters
              </button>
            </div>
          </div>

          {/* Filter summary */}
          {hasFilters && (
            <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
              <p className="text-[13px] text-slate-500">
                Showing{" "}
                <span className="font-medium text-slate-900">{purchases.length}</span>{" "}
                result{purchases.length !== 1 ? "s" : ""}
                {filters.supplier && (
                  <> · <span className="text-slate-700">{filters.supplier}</span></>
                )}
                {filters.from && (
                  <> · from <span className="text-slate-700">{filters.from}</span></>
                )}
                {filters.to && (
                  <> · to <span className="text-slate-700">{filters.to}</span></>
                )}
              </p>
            </div>
          )}

          {/* Quick nav */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[13px] font-medium text-slate-400 uppercase tracking-wide mb-3">Quick nav</p>
            <div className="flex flex-col gap-1">
              <Link
                href="/purchases"
                className="text-[13px] px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors no-underline"
              >
                ← New purchase order
              </Link>
              <Link
                href="/billing"
                className="text-[13px] px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors no-underline"
              >
                New invoice →
              </Link>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Purchase list ── */}
        <div className="flex flex-col gap-4">

          {error && (
            <div className="border border-red-100 bg-red-50 rounded-xl px-4 py-3 text-[13px] text-red-600">
              {error}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Table header */}
            <div
              className="grid px-5 py-3 bg-slate-50 border-b border-slate-100"
              style={{ gridTemplateColumns: "1.2fr 1.4fr 0.8fr 0.8fr 0.8fr 100px 90px" }}
            >
              {["Code", "Supplier · Warehouse", "Date", "Total", "Due", "Status", ""].map((h) => (
                <span key={h} className="text-[12px] font-medium text-slate-400 uppercase tracking-wide">{h}</span>
              ))}
            </div>

            {/* Loading refresh indicator */}
            {loading && (
              <div className="px-5 py-2.5 bg-white border-b border-slate-100 text-[13px] text-slate-400">
                Refreshing...
              </div>
            )}

            {/* Empty state */}
            {purchases.length === 0 && !loading ? (
              <div className="p-10 text-center">
                <p className="text-[14px] text-slate-300 mb-3">No purchases match these filters.</p>
                <button
                  type="button"
                  onClick={() => setFilters(defaultFilters)}
                  className="text-[13px] px-4 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                {purchases.map((p) => (
                  <div
                    key={p.id}
                    className="grid items-center px-5 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group"
                    style={{ gridTemplateColumns: "1.2fr 1.4fr 0.8fr 0.8fr 0.8fr 100px 90px" }}
                  >
                    {/* Code */}
                    <div>
                      <p className="text-[14px] font-medium text-slate-900">{p.groupCode}</p>
                      {p.referenceNo && (
                        <p className="text-[13px] text-slate-400">ref: {p.referenceNo}</p>
                      )}
                    </div>

                    {/* Supplier + warehouse */}
                    <div>
                      <p className="text-[14px] text-slate-900 truncate max-w-[200px]">{p.supplierName}</p>
                      <p className="text-[13px] text-slate-400">{p.warehouse}</p>
                    </div>

                    {/* Date */}
                    <div className="text-[14px] text-slate-700">{isoDate(p.purchaseDate)}</div>

                    {/* Grand total */}
                    <div className="text-[14px] font-medium text-slate-900">{fmt(p.grandTotal)}</div>

                    {/* Due */}
                    <div>
                      <span
                        className={`text-[14px] font-medium ${
                          num(p.dueAmount) > 0 ? "text-red-500" : "text-slate-300"
                        }`}
                      >
                        {fmt(p.dueAmount)}
                      </span>
                    </div>

                    {/* Status */}
                    <div>
                      <StatusBadge status={p.status} />
                    </div>

                    {/* Edit button */}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => openEdit(p.id)}
                        disabled={loadingId === p.id}
                        className="text-[13px] font-medium px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingId === p.id ? "Loading..." : "Edit →"}
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer row */}
          {purchases.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[13px] text-slate-400">
                {purchases.length} record{purchases.length !== 1 ? "s" : ""}
              </span>
              <a
                href={historyExportUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors no-underline"
              >
                Export all as Excel ↗
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-screen-xl mx-auto px-6 pb-6">
        <div className="flex items-center justify-between border-t border-slate-200 pt-5">
          <span className="text-[13px] text-slate-400">Phase 1 · Next.js · Prisma · MySQL</span>
          <Link
            href="/billing"
            className="text-[13px] font-medium px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors no-underline"
          >
            New invoice →
          </Link>
        </div>
      </div>
    </div>
  );
}