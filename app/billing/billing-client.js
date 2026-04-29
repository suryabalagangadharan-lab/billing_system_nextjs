"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function fmt(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function calcLine(unitPrice, quantity, gstRate) {
  const subtotal = Number(unitPrice) * quantity;
  const gstAmount = subtotal * (Number(gstRate || 0) / 100);
  return { subtotal, gstAmount, total: subtotal + gstAmount };
}

export default function BillingClient() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState("1");
  const [customer, setCustomer] = useState({ customerName: "", customerPhone: "" });
  const [items, setItems] = useState([]);
  const [labourCharge, setLabourCharge] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const searchRef = useRef(null);
  const quantityRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (!active) return;
        const valid = (payload.products || []).filter(
          (p) => p?.id && p?.name && p?.unitPrice != null
        );
        setProducts(valid);
        setCatalogLoaded(true);
      })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Search across name, sku, brand AND category — no row limit
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) =>
      [p.name, p.sku, p.brand?.name, p.category?.name, p.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [products, query]);

  useEffect(() => {
    setActiveIndex(0);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query]);

  // Keep active row visible
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector("[data-active='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function selectProduct(p) {
    setSelectedProduct(p);
    setQuery(p.name);
    setError("");
    window.requestAnimationFrame(() => {
      quantityRef.current?.focus();
      quantityRef.current?.select();
    });
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
    if (selectedProduct.stock < nextQty) { setError(`Only ${selectedProduct.stock} units available.`); return; }
    setItems((cur) => {
      if (existing) {
        const line = calcLine(existing.unitPrice, nextQty, existing.gstRate);
        return cur.map((i) => i.productId === selectedProduct.id ? { ...i, quantity: nextQty, ...line } : i);
      }
      const gstRate = Number(selectedProduct.gstRate || 0);
      const line = calcLine(Number(selectedProduct.unitPrice), qty, gstRate);
      return [...cur, {
        productId: selectedProduct.id,
        name: selectedProduct.name,
        sku: selectedProduct.sku,
        category: selectedProduct.category?.name || selectedProduct.category || "",
        quantity: qty,
        unitPrice: Number(selectedProduct.unitPrice),
        gstRate,
        ...line,
        stock: selectedProduct.stock,
      }];
    });
    setSelectedProduct(null);
    setQuery("");
    setQuantity("1");
    setError("");
    searchRef.current?.focus();
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
    setItems((cur) => cur.map((item) =>
      item.productId !== productId ? item
        : { ...item, gstRate: rate, ...calcLine(item.unitPrice, item.quantity, rate) }
    ));
  }

  function removeItem(productId) {
    setItems((cur) => cur.filter((i) => i.productId !== productId));
    searchRef.current?.focus();
  }

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const tax = items.reduce((s, i) => s + i.gstAmount, 0);
  const labour = Number(labourCharge) || 0;
  const grand = items.reduce((s, i) => s + i.total, 0) + labour;

  async function submit() {
    if (!catalogLoaded || !products.length) { setError("Products not loaded yet."); return; }
    if (!customer.customerName.trim()) { setError("Customer name is required."); return; }
    if (!items.length) { setError("Add at least one item."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customer.customerName,
          customerPhone: customer.customerPhone,
          gstRate: 0,
          labourCharge: labour,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, gstRate: i.gstRate })),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Unable to create invoice.");
      setSuccess(`Invoice ${payload.invoice.invoiceNumber} created.`);
      setItems([]); setCustomer({ customerName: "", customerPhone: "" });
      setQuery(""); setQuantity("1"); setLabourCharge("");
      searchRef.current?.focus();
    } catch (e) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  const displayName = customer.customerName.trim() || "Walk-in Customer";

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100">

      {/* ── Top Bar ── */}
      <header className="flex-none flex items-center justify-between bg-slate-900 px-6 py-3 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-base tracking-tight">Counter Billing</span>
          <span className="text-slate-500 text-sm">/ New Invoice</span>
        </div>
        <div className="flex items-center gap-5 text-xs text-slate-400 uppercase tracking-widest">
          <span>↑↓ navigate</span>
          <span>Enter select / add</span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            catalogLoaded ? "bg-emerald-900 text-emerald-400" : "bg-amber-900 text-amber-400"
          }`}>
            {catalogLoaded ? `${products.length} products` : "Loading…"}
          </span>
        </div>
      </header>

      {/* ── Split Layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ══════════ LEFT — Product Search ══════════ */}
        <div className="w-[52%] flex flex-col border-r border-slate-700 bg-slate-900 overflow-hidden">

          {/* Customer */}
          <div className="flex-none flex gap-3 px-5 py-4 border-b border-slate-800">
            <div className="flex-1">
              <label className="block text-xs uppercase tracking-widest text-slate-500 mb-1.5">
                Customer Name
              </label>
              <input
                value={customer.customerName}
                onChange={(e) => setCustomer((c) => ({ ...c, customerName: e.target.value }))}
                placeholder="Walk-in Customer"
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-slate-400 placeholder:text-slate-600"
              />
            </div>
            <div className="w-44">
              <label className="block text-xs uppercase tracking-widest text-slate-500 mb-1.5">
                Phone
              </label>
              <input
                value={customer.customerPhone}
                onChange={(e) => setCustomer((c) => ({ ...c, customerPhone: e.target.value }))}
                placeholder="Optional"
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-slate-400 placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Search + Qty + Add */}
          <div className="flex-none flex gap-3 px-5 py-4 border-b border-slate-800">
            <div className="flex-1">
              <label className="block text-xs uppercase tracking-widest text-slate-500 mb-1.5">
                Search Product
              </label>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedProduct(null); }}
                onKeyDown={handleSearchKey}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-slate-400 placeholder:text-slate-600 caret-white"
                placeholder="Name, SKU, brand or category…"
                autoFocus
              />
            </div>
            <div className="w-24">
              <label className="block text-xs uppercase tracking-widest text-slate-500 mb-1.5">
                Qty
              </label>
              <input
                ref={quantityRef}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-slate-400 caret-white text-center"
                placeholder="1"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={addItem}
                className="bg-white text-slate-900 text-sm font-semibold px-5 py-2.5 rounded-md hover:bg-slate-100 active:bg-slate-200 transition-colors whitespace-nowrap"
              >
                Add →
              </button>
            </div>
          </div>

          {/* Results list — shows ALL matches, scrollable */}
          <div ref={listRef} className="flex-1 overflow-y-auto">
            {query.trim() ? (
              loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-12 bg-slate-800 rounded-md animate-pulse" />
                  ))}
                </div>
              ) : filtered.length ? (
                <>
                  {/* Column header */}
                  <div className="grid grid-cols-[1fr_100px_76px_68px_92px] gap-2 px-5 py-2.5 text-xs uppercase tracking-widest text-slate-600 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                    <span>Product</span>
                    <span>Category</span>
                    <span>SKU</span>
                    <span className="text-right">Stock</span>
                    <span className="text-right">Price</span>
                  </div>

                  {filtered.map((p, i) => {
                    const cat = p.category?.name || p.category || "—";
                    const isActive = i === activeIndex;
                    return (
                      <button
                        key={p.id}
                        data-active={String(isActive)}
                        type="button"
                        onClick={() => selectProduct(p)}
                        className={`grid w-full grid-cols-[1fr_100px_76px_68px_92px] gap-2 px-5 py-3.5 text-left transition-colors border-b border-slate-800 ${
                          isActive
                            ? "bg-white"
                            : "hover:bg-slate-800"
                        }`}
                      >
                        <span className={`font-semibold truncate text-sm ${isActive ? "text-slate-900" : "text-slate-100"}`}>
                          {p.name}
                        </span>
                        <span className={`text-xs truncate ${isActive ? "text-blue-600" : "text-slate-500"}`}>
                          {cat}
                        </span>
                        <span className={`text-xs truncate ${isActive ? "text-slate-500" : "text-slate-600"}`}>
                          {p.sku || "—"}
                        </span>
                        <span className={`text-right text-xs ${isActive ? "text-slate-500" : "text-slate-600"}`}>
                          {p.stock} pcs
                        </span>
                        <span className={`text-right text-sm font-bold ${isActive ? "text-slate-900" : "text-slate-300"}`}>
                          {fmt(p.unitPrice)}
                        </span>
                      </button>
                    );
                  })}

                  <div className="px-5 py-2.5 text-xs text-slate-700 border-t border-slate-800 sticky bottom-0 bg-slate-900">
                    {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 py-16">
                  <span className="text-4xl mb-3">🔍</span>
                  <p className="text-sm">No matching products.</p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16">
                <span className="text-5xl mb-4 opacity-20">⌨</span>
                <p className="text-sm text-slate-600">Type to search by name, SKU, brand or category</p>
              </div>
            )}
          </div>

          {/* Error / success strips */}
          {error && (
            <div className="flex-none px-5 py-3 bg-rose-950 border-t border-rose-900">
              <p className="text-sm text-rose-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex-none px-5 py-3 bg-emerald-950 border-t border-emerald-900">
              <p className="text-sm text-emerald-400">{success}</p>
            </div>
          )}
        </div>

        {/* ══════════ RIGHT — Invoice ══════════ */}
        <div className="w-[48%] flex flex-col overflow-hidden bg-white">

          {/* Stats header */}
          <div className="flex-none flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Invoice Preview</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">{displayName}</p>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Items</p>
                <p className="text-xl font-bold text-slate-800 leading-tight">{items.length}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Subtotal</p>
                <p className="text-xl font-bold text-slate-800 leading-tight">{fmt(subtotal)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Grand Total</p>
                <p className="text-xl font-bold text-slate-900 leading-tight">{fmt(grand)}</p>
              </div>
            </div>
          </div>

          {/* Table column header */}
          <div className="flex-none grid grid-cols-[2fr_52px_90px_52px_80px_88px_28px] gap-1.5 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-widest text-slate-400">
            <span>Item</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Price</span>
            <span className="text-center">GST%</span>
            <span className="text-right">GST</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          {/* Line items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {items.length ? items.map((item) => (
              <div
                key={item.productId}
                className="grid grid-cols-[2fr_52px_90px_52px_80px_88px_28px] gap-1.5 px-5 py-3 items-center hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-slate-900 font-semibold truncate text-sm">{item.name}</p>
                  <p className="text-slate-400 text-xs truncate">
                    {item.category ? `${item.category} · ` : ""}{item.sku || "—"}
                  </p>
                </div>
                <input
                  value={item.quantity}
                  onChange={(e) => updateQty(item.productId, e.target.value)}
                  className="border border-slate-200 rounded px-1.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-700 w-full text-center"
                />
                <p className="text-slate-600 text-sm text-right">{fmt(item.unitPrice)}</p>
                <input
                  value={item.gstRate}
                  onChange={(e) => updateGst(item.productId, e.target.value)}
                  className="border border-slate-200 rounded px-1.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-700 w-full text-center"
                />
                <p className="text-slate-500 text-sm text-right">{fmt(item.gstAmount)}</p>
                <p className="text-slate-900 font-bold text-sm text-right">{fmt(item.total)}</p>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="text-slate-300 hover:text-rose-500 transition-colors text-center text-xl leading-none"
                >
                  ×
                </button>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 py-16">
                <span className="text-5xl mb-4">🧾</span>
                <p className="text-sm text-slate-400">No items added yet.</p>
                <p className="text-xs mt-1 text-slate-400">Search and add products from the left panel.</p>
              </div>
            )}
          </div>

          {/* Totals + Labour + Submit */}
          <div className="flex-none border-t border-slate-100 bg-slate-50 px-5 py-4">
            <div className="flex items-end gap-5">
              <div className="flex-1 space-y-2 text-sm text-slate-500">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="text-slate-700 font-medium">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST</span>
                  <span className="text-slate-700 font-medium">{fmt(tax)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
                  <span>Labour Charge</span>
                  <input
                    value={labourCharge}
                    onChange={(e) => setLabourCharge(e.target.value)}
                    placeholder="0.00"
                    className="w-28 border border-slate-200 rounded-md bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-600 text-right"
                  />
                </div>
                <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2">
                  <span>Grand Total</span>
                  <span>{fmt(grand)}</span>
                </div>
              </div>

              <button
                onClick={submit}
                disabled={saving}
                className="bg-slate-900 text-white text-sm font-bold px-7 py-3.5 rounded-md hover:bg-slate-700 active:bg-black transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {saving ? "Creating…" : "Create Invoice →"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
