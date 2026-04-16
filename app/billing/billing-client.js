"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast-provider";

function fmt(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function calcLine(unitPrice, quantity, gstRate) {
  const subtotal = Number(unitPrice) * quantity;
  const gstAmount = subtotal * (Number(gstRate || 0) / 100);
  return { subtotal, gstAmount, total: subtotal + gstAmount };
}

function Stat({ label, value, sub, accent }) {
  return (
    <div className={`border rounded-sm px-5 py-4 ${accent ? "bg-slate-900 border-slate-900" : "bg-white border-slate-200"}`}>
      <p className={`text-[10px] font-mono uppercase tracking-[0.2em] mb-1 ${accent ? "text-slate-400" : "text-slate-400"}`}>{label}</p>
      <p className={`text-xl font-semibold tracking-tight font-mono ${accent ? "text-white" : "text-slate-900"}`}>{value}</p>
      {sub && <p className={`text-xs font-mono mt-0.5 ${accent ? "text-slate-500" : "text-slate-400"}`}>{sub}</p>}
    </div>
  );
}

export default function BillingClient() {
  const { pushToast } = useToast();
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState("1");
  const [customer, setCustomer] = useState({ customerName: "", customerPhone: "" });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const searchRef = useRef(null);
  const quantityRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (!active) return;
        const valid = (payload.products || []).filter((p) => p?.id && p?.name && p?.unitPrice != null);
        setProducts(valid);
        setCatalogLoaded(true);
      })
      .catch((e) => { if (active) { setError(e.message); pushToast({ title: "Catalog unavailable", description: e.message, tone: "error" }); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pushToast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 10);
    return products.filter((p) => [p.name, p.sku, p.brand?.name].filter(Boolean).join(" ").toLowerCase().includes(q)).slice(0, 10);
  }, [products, query]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  function focusSearch() { searchRef.current?.focus(); }

  function selectProduct(p) {
    setSelectedProduct(p);
    setQuery(p.name);
    setError("");
    window.requestAnimationFrame(() => { quantityRef.current?.focus(); quantityRef.current?.select(); });
  }

  function handleSearchKey(e) {
    if (!filtered.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % filtered.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length); }
    if (e.key === "Enter") { e.preventDefault(); selectProduct(filtered[activeIndex]); }
  }

  function addItem() {
    if (!catalogLoaded) { setError("Catalog loading. Try again."); return; }
    if (!selectedProduct) { setError("Select a product first."); return; }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) { setError("Quantity must be a positive whole number."); return; }
    const existing = items.find((i) => i.productId === selectedProduct.id);
    const nextQty = existing ? existing.quantity + qty : qty;
    if (selectedProduct.stock < nextQty) {
      setError(`Only ${selectedProduct.stock} units available.`);
      pushToast({ title: "Low stock", description: `${selectedProduct.name} has ${selectedProduct.stock} units.`, tone: "warning" });
      return;
    }
    setItems((cur) => {
      if (existing) {
        const line = calcLine(existing.unitPrice, nextQty, existing.gstRate);
        return cur.map((i) => i.productId === selectedProduct.id ? { ...i, quantity: nextQty, ...line } : i);
      }
      const gstRate = Number(selectedProduct.gstRate || 0);
      const line = calcLine(Number(selectedProduct.unitPrice), qty, gstRate);
      return [...cur, { productId: selectedProduct.id, name: selectedProduct.name, sku: selectedProduct.sku, quantity: qty, unitPrice: Number(selectedProduct.unitPrice), gstRate, ...line, stock: selectedProduct.stock }];
    });
    setSelectedProduct(null); setQuery(""); setQuantity("1"); setError(""); focusSearch();
  }

  function updateQty(productId, val) {
    const qty = Number(val);
    if (!Number.isInteger(qty) || qty <= 0) return;
    setItems((cur) => cur.map((item) => {
      if (item.productId !== productId) return item;
      if (qty > item.stock) { setError(`Only ${item.stock} units available.`); return item; }
      return { ...item, quantity: qty, ...calcLine(item.unitPrice, qty, item.gstRate) };
    }));
  }

  function updateGst(productId, val) {
    const rate = Number(val);
    if (!Number.isFinite(rate) || rate < 0) return;
    setItems((cur) => cur.map((item) => item.productId !== productId ? item : { ...item, gstRate: rate, ...calcLine(item.unitPrice, item.quantity, rate) }));
  }

  function removeItem(productId) { setItems((cur) => cur.filter((i) => i.productId !== productId)); focusSearch(); }

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const tax = items.reduce((s, i) => s + i.gstAmount, 0);
  const grand = items.reduce((s, i) => s + i.total, 0);

  async function submit() {
    if (!catalogLoaded || !products.length) { setError("Products not loaded yet."); return; }
    if (!customer.customerName.trim()) { setError("Customer name is required."); return; }
    if (!items.length) { setError("Add at least one item."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: customer.customerName, customerPhone: customer.customerPhone, gstRate: 0, items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, gstRate: i.gstRate })) }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Unable to create invoice.");
      setSuccess(`Invoice ${payload.invoice.invoiceNumber} created.`);
      pushToast({ title: "Invoice created", description: payload.invoice.invoiceNumber, tone: "success" });
      setItems([]); setCustomer({ customerName: "", customerPhone: "" }); setQuery(""); setQuantity("1"); focusSearch();
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Invoice failed", description: e.message, tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 ">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 pb-5 mb-6">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-1">Counter Mode</p>
          <h1 className="text-xl font-semibold text-slate-900">Billing</h1>
        </div>
        <button onClick={focusSearch} className="text-xs font-mono px-3 py-2 border border-slate-200 rounded-sm bg-white text-slate-600 hover:bg-slate-50 transition-colors">
          focus search <kbd className="ml-1 text-slate-400">F</kbd>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Line Items" value={items.length} sub="On current invoice" />
        <Stat label="Subtotal" value={fmt(subtotal)} sub="Before GST" />
        <Stat label="Grand Total" value={fmt(grand)} sub="Ready to bill" accent />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {/* Quick add panel */}
          <div className="border border-slate-900 rounded-sm bg-slate-900 p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 mb-4">Quick Add</p>
            <div className="grid grid-cols-[1fr_120px_auto] gap-3 mb-3">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500 mb-1.5">Product search</label>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelectedProduct(null); }}
                  onKeyDown={handleSearchKey}
                  className="w-full border border-slate-700 rounded-sm bg-slate-800 text-white text-sm font-mono px-3 py-2.5 outline-none focus:border-slate-400 placeholder:text-slate-600 caret-white"
                  placeholder="name, SKU, or brand..."
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500 mb-1.5">Qty</label>
                <input
                  ref={quantityRef}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                  className="w-full border border-slate-700 rounded-sm bg-slate-800 text-white text-sm font-mono px-3 py-2.5 outline-none focus:border-slate-400 caret-white"
                  placeholder="1"
                />
              </div>
              <div className="flex items-end">
                <button onClick={addItem} className="bg-white text-slate-900 text-xs font-mono font-semibold px-4 py-2.5 rounded-sm hover:bg-slate-100 transition-colors whitespace-nowrap">
                  add →
                </button>
              </div>
            </div>

            {/* Product list */}
            <div className="border border-slate-800 rounded-sm overflow-hidden">
              {loading ? (
                <div className="p-3 space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-slate-800 rounded-sm animate-pulse" />)}
                </div>
              ) : filtered.length ? (
                filtered.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectProduct(p)}
                    className={`grid w-full grid-cols-[1fr_80px_90px] gap-3 px-4 py-2.5 text-left text-xs font-mono transition-colors ${i === activeIndex ? "bg-white text-slate-900" : "text-slate-400 hover:bg-slate-800"}`}
                  >
                    <div>
                      <span className={`font-medium ${i === activeIndex ? "text-slate-900" : "text-slate-200"}`}>{p.name}</span>
                      <span className={`ml-2 ${i === activeIndex ? "text-slate-500" : "text-slate-600"}`}>{p.sku}</span>
                    </div>
                    <span className={i === activeIndex ? "text-slate-500" : "text-slate-600"}>{p.stock} pcs</span>
                    <span className={`text-right ${i === activeIndex ? "text-slate-700" : "text-slate-400"}`}>{fmt(p.unitPrice)}</span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-4 text-xs font-mono text-slate-600">No matching products.</div>
              )}
            </div>

            <div className="flex gap-4 mt-3 text-[10px] font-mono text-slate-600 uppercase tracking-[0.15em]">
              <span>↑↓ move</span><span>enter select</span><span>enter on qty to add</span>
            </div>
          </div>

          {/* Invoice table */}
          <div className="border border-slate-200 rounded-sm bg-white p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-900 font-semibold mb-4">Invoice Preview</p>
            <div className="overflow-hidden border border-slate-100 rounded-sm">
              <div className="grid grid-cols-[1.2fr_60px_80px_60px_80px_90px_32px] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-slate-400">
                <span>Item</span><span>Qty</span><span>Price</span><span>GST%</span><span>GST</span><span>Total</span><span></span>
              </div>
              <div className="divide-y divide-slate-100">
                {items.length ? items.map((item) => (
                  <div key={item.productId} className="grid grid-cols-[1.2fr_60px_80px_60px_80px_90px_32px] gap-2 px-3 py-3 items-center text-xs font-mono">
                    <div>
                      <p className="text-slate-900 font-medium">{item.name}</p>
                      <p className="text-slate-400">{item.sku || "—"}</p>
                    </div>
                    <input value={item.quantity} onChange={(e) => updateQty(item.productId, e.target.value)} className="border border-slate-200 rounded-sm px-2 py-1.5 text-xs font-mono text-slate-900 outline-none focus:border-slate-900 w-full" />
                    <p className="text-slate-600">{fmt(item.unitPrice)}</p>
                    <input value={item.gstRate} onChange={(e) => updateGst(item.productId, e.target.value)} className="border border-slate-200 rounded-sm px-2 py-1.5 text-xs font-mono text-slate-900 outline-none focus:border-slate-900 w-full" />
                    <p className="text-slate-500">{fmt(item.gstAmount)}</p>
                    <p className="text-slate-900 font-semibold">{fmt(item.total)}</p>
                    <button onClick={() => removeItem(item.productId)} className="text-slate-300 hover:text-rose-500 transition-colors text-center font-mono">×</button>
                  </div>
                )) : (
                  <div className="px-4 py-8 text-center text-xs font-mono text-slate-300">
                    Start typing to add your first item.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Customer */}
          <div className="border border-slate-200 rounded-sm bg-white p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-900 font-semibold mb-4">Customer</p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500">Name</span>
                <input
                  value={customer.customerName}
                  onChange={(e) => setCustomer((c) => ({ ...c, customerName: e.target.value }))}
                  placeholder="Walk-in customer"
                  className="mt-1.5 w-full border border-slate-200 rounded-sm px-3 py-2.5 text-sm font-mono text-slate-900 outline-none focus:border-slate-900 placeholder:text-slate-300"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500">Phone</span>
                <input
                  value={customer.customerPhone}
                  onChange={(e) => setCustomer((c) => ({ ...c, customerPhone: e.target.value }))}
                  placeholder="Optional"
                  className="mt-1.5 w-full border border-slate-200 rounded-sm px-3 py-2.5 text-sm font-mono text-slate-900 outline-none focus:border-slate-900 placeholder:text-slate-300"
                />
              </label>
            </div>
          </div>

          {/* Totals + submit */}
          <div className="border border-slate-900 rounded-sm bg-slate-900 p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 mb-4">Totals</p>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>GST</span><span>{fmt(tax)}</span>
              </div>
              <div className="flex justify-between text-base font-mono font-semibold text-white border-t border-slate-700 pt-3">
                <span>Grand Total</span><span>{fmt(grand)}</span>
              </div>
            </div>
            {error && <p className="text-xs font-mono text-rose-400 mb-3">{error}</p>}
            {success && <p className="text-xs font-mono text-emerald-400 mb-3">{success}</p>}
            <button
              onClick={submit}
              disabled={saving}
              className="w-full bg-white text-slate-900 text-sm font-mono font-semibold py-3 rounded-sm hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              {saving ? "creating..." : "create invoice →"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}