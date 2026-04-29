"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast-provider";

const warehouses = ["Main Warehouse", "Service Counter", "Spare Stock Room"];
const paymentTypes = ["Cash", "UPI", "Card", "Bank Transfer", "Credit"];
const accounts = ["Cash", "HDFC Bank", "ICICI Bank", "UPI", "Card Machine"];

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

function Label({ children }) {
  return (
    <span className="block text-[10px] font-medium text-slate-500 mb-1 tracking-wide uppercase">
      {children}
    </span>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full border border-slate-200 rounded-lg bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-slate-400 transition-colors placeholder:text-slate-300 ${className}`}
      {...props}
    />
  );
}

function Select({ children, className = "", ...props }) {
  return (
    <select
      className={`w-full border border-slate-200 rounded-lg bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-slate-400 transition-colors ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function CardHeader({ title, subtitle, step }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
      <div>
        <p className="text-[13px] font-medium text-slate-900">{title}</p>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {step && (
        <span className="text-[10px] font-medium text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
          Step {step}
        </span>
      )}
    </div>
  );
}

const navItems = ["Dashboard", "Products", "Billing", "Purchases", "Service", "Reports", "Invoices"];
const navLinks = ["/dashboard", "/products", "/billing", "/purchases", "/service", "/reports", "/invoices"];

export default function PurchasesClient() {
  const { pushToast } = useToast();
  const searchInputRef = useRef(null);
  const [dropdownRect, setDropdownRect] = useState(null);

  const [products, setProducts] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [activePurchase, setActivePurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPurchase, setLoadingPurchase] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [items, setItems] = useState([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const [form, setForm] = useState({
    warehouse: warehouses[0],
    supplierName: "",
    referenceNo: "",
    purchaseDate: isoDate(),
    note: "",
    otherCharges: "",
    discountOnAll: "",
    roundOff: "",
  });

  const [draft, setDraft] = useState({
    quantity: "1",
    purchasePrice: "",
    discountAmount: "",
    gstRate: "",
  });

  const [payment, setPayment] = useState({
    amount: "",
    paymentType: paymentTypes[0],
    account: accounts[0],
    note: "",
  });

  // Update dropdown position whenever query changes
  useEffect(() => {
    if (query.trim() && searchInputRef.current) {
      const rect = searchInputRef.current.getBoundingClientRect();
      setDropdownRect({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [query]);

  // Recompute on scroll/resize
  useEffect(() => {
    const update = () => {
      if (query.trim() && searchInputRef.current) {
        const rect = searchInputRef.current.getBoundingClientRect();
        setDropdownRect({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [query]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [pRes, purRes] = await Promise.all([
          fetch("/api/products", { cache: "no-store" }),
          fetch("/api/purchases?take=8", { cache: "no-store" }),
        ]);
        const pData = await pRes.json();
        const purData = await purRes.json();
        if (!active) return;
        setProducts(pData.products || []);
        setRecentPurchases(purData.purchaseGroups || []);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) =>
      [p.name, p.sku, p.itemCode, p.category, p.brand?.name]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [products, query]);

  const lineItems = useMemo(() => items.map(calcItem), [items]);

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((s, i) => s + i.totalAmount, 0);
    const otherCharges = num(form.otherCharges);
    const discountOnAll = num(form.discountOnAll);
    const roundOff = num(form.roundOff);
    const grandTotal = subtotal + otherCharges - discountOnAll + roundOff;
    return {
      qty: lineItems.reduce((s, i) => s + Number(i.quantity || 0), 0),
      subtotal,
      grandTotal,
      due: activePurchase ? num(activePurchase.dueAmount) : grandTotal,
      paid: activePurchase ? num(activePurchase.paidAmount) : 0,
    };
  }, [activePurchase, form, lineItems]);

  function chooseProduct(product) {
    setSelectedProduct(product);
    setQuery(product.name || "");
    setDropdownRect(null);
    setDraft({
      quantity: "1",
      purchasePrice: product.costPrice ?? product.unitPrice ?? "0.00",
      discountAmount: "0.00",
      gstRate: product.gstRate ?? "0.00",
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
    setItems((cur) => cur.map((i) => i.productId === productId ? { ...i, [key]: value } : i));
  }

  function removeItem(productId) {
    setItems((cur) => cur.filter((i) => i.productId !== productId));
  }

  async function loadPurchase(id) {
    setLoadingPurchase(true);
    try {
      const res = await fetch(`/api/purchases/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load purchase.");
      setActivePurchase(data.purchaseGroup || null);
      setShowPaymentForm(false);
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Could not load purchase", description: e.message, tone: "error" });
    } finally {
      setLoadingPurchase(false);
    }
  }

  async function savePurchase(event) {
    event.preventDefault();
    if (!form.supplierName.trim()) return setError("Supplier name is required.");
    if (!items.length) return setError("Add at least one item.");
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        otherCharges: num(form.otherCharges),
        discountOnAll: num(form.discountOnAll),
        roundOff: num(form.roundOff),
        items: lineItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          purchasePrice: i.purchasePrice,
          discountAmount: i.discountAmount,
          gstRate: i.gstRate,
        })),
      };
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to create purchase.");
      setActivePurchase(data.purchaseGroup || null);
      setRecentPurchases((cur) => [data.purchaseGroup, ...cur].filter(Boolean));
      setItems([]);
      setSelectedProduct(null);
      setQuery("");
      setDropdownRect(null);
      setDraft({ quantity: "1", purchasePrice: "", discountAmount: "", gstRate: "" });
      setForm({
        warehouse: warehouses[0],
        supplierName: "",
        referenceNo: "",
        purchaseDate: isoDate(),
        note: "",
        otherCharges: "",
        discountOnAll: "",
        roundOff: "",
      });
      pushToast({
        title: "Purchase saved",
        description: `${data.purchaseGroup?.groupCode || "Purchase"} created and stock updated.`,
        tone: "success",
      });
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Purchase failed", description: e.message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function addPayment(event) {
    event.preventDefault();
    if (!activePurchase?.id) return setError("Save or select a purchase first.");
    if (!payment.amount || Number(payment.amount) <= 0) return setError("Enter a valid payment amount.");
    setPaying(true);
    setError("");
    try {
      const res = await fetch(`/api/purchases/${activePurchase.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payment),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to add payment.");
      setActivePurchase(data.purchaseGroup || null);
      setRecentPurchases((cur) =>
        cur.map((p) => p.id === data.purchaseGroup.id ? data.purchaseGroup : p)
      );
      setPayment({ amount: "", paymentType: paymentTypes[0], account: accounts[0], note: "" });
      setShowPaymentForm(false);
      pushToast({ title: "Payment saved", description: "Purchase payment recorded.", tone: "success" });
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Payment failed", description: e.message, tone: "error" });
    } finally {
      setPaying(false);
    }
  }

  const activePaid = activePurchase ? num(activePurchase.paidAmount) : 0;
  const activeDue = activePurchase ? num(activePurchase.dueAmount) : totals.grandTotal;
  const activeItems = activePurchase?.purchases || [];
  const activePayments = activePurchase?.payments || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-[13px] text-slate-400">Loading purchases...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Fixed dropdown portal — rendered outside all overflow contexts */}
      {query.trim() && filteredProducts.length > 0 && dropdownRect && (
        <div
          className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
          style={{
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
          }}
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
                <span className="block text-[13px] font-medium text-slate-900">{p.name}</span>
                <span className="block text-[11px] text-slate-400">
                  {p.itemCode || p.sku || "—"}{p.brand?.name ? ` · ${p.brand.name}` : ""}
                </span>
              </span>
              <span className="text-[11px] text-slate-400 whitespace-nowrap">{p.stock ?? 0} in stock</span>
            </button>
          ))}
        </div>
      )}

      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto px-6 h-[52px] flex items-center gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-[14px] font-medium text-slate-900">OpsHub</span>
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-[13px] text-slate-500">Purchases</span>
          </div>
          <nav className="flex items-center gap-0.5 flex-1">
            {navItems.map((item, i) => (
              <Link
                key={item}
                href={navLinks[i]}
                className={`px-3 py-1.5 text-[12px] rounded-lg no-underline transition-colors ${
                  item === "Purchases"
                    ? "bg-slate-100 text-slate-900 font-medium"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                {item}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/purchases/history"
              className="text-[12px] px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors no-underline"
            >
              History ↗
            </Link>
            <Link
              href="/purchases"
              className="text-[12px] px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors no-underline"
            >
              + New purchase
            </Link>
          </div>
        </div>
      </header>

      {/* Page header */}
      <div className="max-w-screen-xl mx-auto px-6 pt-6 pb-2">
        <h1 className="text-[18px] font-medium text-slate-900">New purchase order</h1>
        <p className="text-[12px] text-slate-400 mt-0.5">Receive stock from supplier — inventory updates instantly on save.</p>
      </div>

      {/* Main layout */}
      <div className="max-w-screen-xl mx-auto px-6 pb-8 pt-4 grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">

        {/* ── LEFT ── */}
        <form onSubmit={savePurchase} className="flex flex-col gap-4">

          {/* Step 1 — Order details */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <CardHeader title="Order details" subtitle="Warehouse, supplier, reference & date" step="1" />
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div>
                <Label>Warehouse</Label>
                <Select value={form.warehouse} onChange={(e) => setForm((c) => ({ ...c, warehouse: e.target.value }))}>
                  {warehouses.map((w) => <option key={w}>{w}</option>)}
                </Select>
              </div>
              <div>
                <Label>Supplier name *</Label>
                <Input value={form.supplierName} onChange={(e) => setForm((c) => ({ ...c, supplierName: e.target.value }))} placeholder="e.g. Samsung Distributor" />
              </div>
              <div>
                <Label>Reference no.</Label>
                <Input value={form.referenceNo} onChange={(e) => setForm((c) => ({ ...c, referenceNo: e.target.value }))} placeholder="Bill / GRN no." />
              </div>
              <div>
                <Label>Purchase date</Label>
                <Input type="date" value={form.purchaseDate} onChange={(e) => setForm((c) => ({ ...c, purchaseDate: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Step 2 — Add product */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <CardHeader title="Add product" subtitle="Search by name, SKU, item code or barcode" step="2" />
            <div className="p-5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-[14px] select-none pointer-events-none">⌕</span>
                  <Input
                    ref={searchInputRef}
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setSelectedProduct(null); }}
                    onBlur={() => setTimeout(() => setDropdownRect(null), 150)}
                    placeholder="Search products..."
                    className="pl-8"
                  />
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  disabled={!selectedProduct}
                  className="text-[12px] font-medium px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  + Add item
                </button>
              </div>

              {selectedProduct && (
                <div className="mt-4 border border-slate-200 rounded-xl p-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[13px] font-medium text-slate-900">{selectedProduct.name}</p>
                      <p className="text-[11px] text-slate-400">{selectedProduct.itemCode || selectedProduct.sku || "No code"}</p>
                    </div>
                    <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">Selected</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { key: "quantity", label: "Qty" },
                      { key: "purchasePrice", label: "Purchase price" },
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

          {/* Step 3 — Line items */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <CardHeader
              title="Line items"
              subtitle={`${lineItems.length} product${lineItems.length !== 1 ? "s" : ""} · ${totals.qty} units`}
              step="3"
            />
            {lineItems.length === 0 ? (
              <div className="p-5">
                <div className="border border-dashed border-slate-200 rounded-xl py-10 text-center">
                  <p className="text-[13px] text-slate-300">No items added yet</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div
                  className="grid px-5 py-2.5 bg-slate-50 border-b border-slate-100"
                  style={{ gridTemplateColumns: "2fr 64px 100px 90px 90px 100px 100px 32px" }}
                >
                  {["Item", "Qty", "Cost price", "Discount", "Tax amt", "Unit cost", "Total", ""].map((h) => (
                    <span key={h} className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{h}</span>
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
                        <p className="text-[13px] font-medium text-slate-900 truncate max-w-[160px]">{item.name}</p>
                        <p className="text-[10px] text-slate-400">{item.itemCode || item.sku || "—"}</p>
                      </div>
                      <input type="number" value={item.quantity} onChange={(e) => updateItem(item.productId, "quantity", e.target.value)} className="w-14 border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] text-slate-900 outline-none focus:border-slate-400" />
                      <input type="number" value={item.purchasePrice} onChange={(e) => updateItem(item.productId, "purchasePrice", e.target.value)} className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] text-slate-900 outline-none focus:border-slate-400" />
                      <input type="number" value={item.discountAmount} onChange={(e) => updateItem(item.productId, "discountAmount", e.target.value)} className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] text-slate-900 outline-none focus:border-slate-400" />
                      <span className="text-[12px] text-slate-500">{fmt(calc.taxAmount)}</span>
                      <span className="text-[12px] text-slate-500">{fmt(calc.unitCost)}</span>
                      <span className="text-[12px] font-medium text-slate-900">{fmt(calc.totalAmount)}</span>
                      <button type="button" onClick={() => removeItem(item.productId)} className="text-slate-300 hover:text-red-500 transition-colors text-[13px]">✕</button>
                    </div>
                  );
                })}
                <div className="grid grid-cols-4 border-t border-slate-100 divide-x divide-slate-100">
                  {[
                    { label: "Total qty", value: totals.qty },
                    { label: "Subtotal", value: fmt(totals.subtotal) },
                    { label: "Grand total", value: fmt(totals.grandTotal) },
                    { label: "Due", value: fmt(activeDue), dark: true },
                  ].map(({ label, value, dark }) => (
                    <div key={label} className={`px-5 py-3 ${dark ? "bg-slate-900" : ""}`}>
                      <p className={`text-[10px] font-medium uppercase tracking-wide mb-1 ${dark ? "text-slate-400" : "text-slate-400"}`}>{label}</p>
                      <p className={`text-[14px] font-medium ${dark ? "text-white" : "text-slate-900"}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 4 — Adjustments */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <CardHeader title="Adjustments & submit" subtitle="Additional charges, discounts, round off, notes" step="4" />
            <div className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { key: "otherCharges", label: "Other charges (₹)" },
                  { key: "discountOnAll", label: "Discount on all (₹)" },
                  { key: "roundOff", label: "Round off (₹)" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <Input type="number" value={form[key]} onChange={(e) => setForm((c) => ({ ...c, [key]: e.target.value }))} placeholder="0.00" />
                  </div>
                ))}
              </div>
              <div>
                <Label>Note</Label>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))}
                  placeholder="Internal remark, delivery note, payment terms..."
                  className="w-full border border-slate-200 rounded-lg bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-slate-400 transition-colors placeholder:text-slate-300 resize-none"
                />
              </div>
              {error && (
                <div className="border border-red-100 bg-red-50 rounded-lg px-4 py-2.5 text-[12px] text-red-600">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="text-[12px] font-medium px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Save purchase →"}
                </button>
                <button
                  type="button"
                  onClick={() => { setItems([]); setSelectedProduct(null); setQuery(""); setDropdownRect(null); setError(""); }}
                  className="text-[12px] px-4 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Clear items
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* ── RIGHT ── */}
        <div className="flex flex-col gap-4">

          {/* Active purchase */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <CardHeader title="Active purchase" />
            {activePurchase ? (
              <>
                <div className="px-5 py-3 border-b border-slate-100">
                  <p className="text-[14px] font-medium text-slate-900">{activePurchase.groupCode}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{activePurchase.supplierName} · {activePurchase.warehouse}</p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
                  {[
                    { label: "Paid", value: fmt(activePaid), dark: false },
                    { label: "Due", value: fmt(activeDue), dark: activeDue > 0 },
                    { label: "Date", value: isoDate(activePurchase.purchaseDate), dark: false },
                    { label: "Items", value: activeItems.length, dark: false },
                  ].map(({ label, value, dark }) => (
                    <div key={label} className={`px-4 py-3 ${dark ? "bg-slate-900" : ""}`}>
                      <p className={`text-[10px] font-medium tracking-wide uppercase mb-1 ${dark ? "text-slate-400" : "text-slate-400"}`}>{label}</p>
                      <p className={`text-[13px] font-medium ${dark ? "text-white" : "text-slate-900"}`}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowPaymentForm((v) => !v)}
                    className="w-full text-[12px] font-medium py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    {showPaymentForm ? "Cancel" : "Add payment →"}
                  </button>
                </div>

                {showPaymentForm && (
                  <form onSubmit={addPayment} className="px-4 pb-4 flex flex-col gap-3">
                    <p className="text-[12px] font-medium text-slate-900">Payment entry</p>
                    <div>
                      <Label>Amount (₹)</Label>
                      <Input type="number" value={payment.amount} onChange={(e) => setPayment((c) => ({ ...c, amount: e.target.value }))} placeholder="0.00" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Type</Label>
                        <Select value={payment.paymentType} onChange={(e) => setPayment((c) => ({ ...c, paymentType: e.target.value }))}>
                          {paymentTypes.map((o) => <option key={o}>{o}</option>)}
                        </Select>
                      </div>
                      <div>
                        <Label>Account</Label>
                        <Select value={payment.account} onChange={(e) => setPayment((c) => ({ ...c, account: e.target.value }))}>
                          {accounts.map((o) => <option key={o}>{o}</option>)}
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Remark</Label>
                      <Input value={payment.note} onChange={(e) => setPayment((c) => ({ ...c, note: e.target.value }))} placeholder="Payment note..." />
                    </div>
                    <button
                      type="submit"
                      disabled={paying}
                      className="w-full text-[12px] font-medium py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      {paying ? "Saving..." : "Confirm payment →"}
                    </button>
                  </form>
                )}

                {activePayments.length > 0 && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-4">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">Payment history</p>
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      {activePayments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100 last:border-0">
                          <div>
                            <p className="text-[12px] font-medium text-slate-900">{p.paymentType}</p>
                            <p className="text-[10px] text-slate-400">{isoDate(p.createdAt)} · {p.account || "—"}</p>
                          </div>
                          <p className="text-[12px] font-medium text-slate-900">{fmt(p.amount)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-5">
                <div className="border border-dashed border-slate-200 rounded-xl py-8 text-center">
                  <p className="text-[12px] text-slate-300">Save a purchase or select one below</p>
                </div>
              </div>
            )}
          </div>

          {/* Recent purchases */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <p className="text-[13px] font-medium text-slate-900">Recent purchases</p>
              {loadingPurchase && <span className="text-[11px] text-slate-400">Loading...</span>}
            </div>
            {recentPurchases.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-[12px] text-slate-300">No purchases yet</p>
              </div>
            ) : (
              <>
                {recentPurchases.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => loadPurchase(p.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 transition-colors ${
                      activePurchase?.id === p.id ? "bg-slate-900" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-[12px] font-medium ${activePurchase?.id === p.id ? "text-white" : "text-slate-900"}`}>{p.groupCode}</span>
                      <span className={`text-[12px] font-medium ${activePurchase?.id === p.id ? "text-white" : "text-slate-900"}`}>{fmt(p.grandTotal)}</span>
                    </div>
                    <p className={`text-[11px] mb-1.5 ${activePurchase?.id === p.id ? "text-slate-400" : "text-slate-400"}`}>{p.supplierName} · {isoDate(p.purchaseDate)}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      activePurchase?.id === p.id
                        ? "bg-white/10 text-white/70 border-white/20"
                        : p.status === "paid"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {p.status}
                    </span>
                  </button>
                ))}
                <div className="p-3">
                  <Link
                    href="/purchases/history"
                    className="block w-full text-center text-[12px] text-slate-400 hover:text-slate-700 border border-slate-200 rounded-lg py-2 hover:bg-slate-50 transition-colors no-underline"
                  >
                    View full history ↗
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}