"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function normalizeSearchValue(value) {
  return value.trim().toLowerCase();
}

function calculateLineTotals(unitPrice, quantity, gstRate) {
  const subtotal = Number(unitPrice) * quantity;
  const gstAmount = subtotal * (Number(gstRate || 0) / 100);
  const total = subtotal + gstAmount;

  return { subtotal, gstAmount, total };
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

    async function loadProducts() {
      try {
        const response = await fetch("/api/products", {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load products.");
        }

        if (!active) {
          return;
        }

        const nextProducts = (payload.products || []).filter(
          (product) => product?.id && product?.name && product?.unitPrice !== undefined && product?.unitPrice !== null
        );
        setProducts(nextProducts);
        setCatalogLoaded(true);
        setError("");
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError.message || "Unable to load products.";
        setError(message);
        setCatalogLoaded(false);
        pushToast({
          title: "Catalog unavailable",
          description: message,
          tone: "error",
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, [pushToast]);

  const filteredProducts = useMemo(() => {
    const search = normalizeSearchValue(query);

    if (!search) {
      return products.slice(0, 8);
    }

    return products
      .filter((product) => {
        const haystack = [product.name, product.sku, product.brand?.name].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(search);
      })
      .slice(0, 8);
  }, [products, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function focusSearch() {
    searchRef.current?.focus();
  }

  function selectProduct(product) {
    setSelectedProduct(product);
    setQuery(product.name);
    setError("");
    window.requestAnimationFrame(() => {
      quantityRef.current?.focus();
      quantityRef.current?.select();
    });
  }

  function handleSearchKeyDown(event) {
    if (!filteredProducts.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % filteredProducts.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + filteredProducts.length) % filteredProducts.length);
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectProduct(filteredProducts[activeIndex]);
    }
  }

  function addItem() {
    if (!catalogLoaded) {
      setError("Product catalog is still loading. Please try again in a moment.");
      return;
    }

    if (!selectedProduct) {
      setError("Select a product before adding it to the invoice.");
      return;
    }

    const parsedQuantity = Number(quantity);

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setError("Quantity must be a positive whole number.");
      return;
    }

    const alreadyAdded = items.find((item) => item.productId === selectedProduct.id);
    const nextQuantity = alreadyAdded ? alreadyAdded.quantity + parsedQuantity : parsedQuantity;

    if (selectedProduct.stock < nextQuantity) {
      setError(`Only ${selectedProduct.stock} units available for ${selectedProduct.name}.`);
      pushToast({
        title: "Low stock warning",
        description: `${selectedProduct.name} has only ${selectedProduct.stock} unit(s) available.`,
        tone: "warning",
      });
      return;
    }

    setItems((current) => {
      if (alreadyAdded) {
        const line = calculateLineTotals(alreadyAdded.unitPrice, nextQuantity, alreadyAdded.gstRate);
        return current.map((item) =>
          item.productId === selectedProduct.id
            ? {
                ...item,
                quantity: nextQuantity,
                subtotal: line.subtotal,
                gstAmount: line.gstAmount,
                total: line.total,
              }
            : item
        );
      }
      const gstRate = Number(selectedProduct.gstRate || 0);
      const line = calculateLineTotals(Number(selectedProduct.unitPrice), parsedQuantity, gstRate);

      return [
        ...current,
        {
          productId: selectedProduct.id,
          name: selectedProduct.name,
          sku: selectedProduct.sku,
          quantity: parsedQuantity,
          unitPrice: Number(selectedProduct.unitPrice),
          gstRate,
          subtotal: line.subtotal,
          gstAmount: line.gstAmount,
          total: line.total,
          stock: selectedProduct.stock,
        },
      ];
    });

    setSelectedProduct(null);
    setQuery("");
    setQuantity("1");
    setError("");
    focusSearch();
  }

  function handleQuantityKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      addItem();
    }
  }

  function updateItemQuantity(productId, nextQuantity) {
    const parsedQuantity = Number(nextQuantity);

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      return;
    }

    setItems((current) =>
      current.map((item) => {
        if (item.productId !== productId) {
          return item;
        }

        if (parsedQuantity > item.stock) {
          setError(`Only ${item.stock} units available for ${item.name}.`);
          pushToast({
            title: "Low stock warning",
            description: `${item.name} has only ${item.stock} unit(s) available.`,
            tone: "warning",
          });
          return item;
        }
        const line = calculateLineTotals(item.unitPrice, parsedQuantity, item.gstRate);

        return {
          ...item,
          quantity: parsedQuantity,
          subtotal: line.subtotal,
          gstAmount: line.gstAmount,
          total: line.total,
        };
      })
    );
  }

  function updateItemGstRate(productId, nextGstRate) {
    const parsedGstRate = Number(nextGstRate);

    if (!Number.isFinite(parsedGstRate) || parsedGstRate < 0) {
      return;
    }

    setItems((current) =>
      current.map((item) => {
        if (item.productId !== productId) {
          return item;
        }
        const line = calculateLineTotals(item.unitPrice, item.quantity, parsedGstRate);

        return {
          ...item,
          gstRate: parsedGstRate,
          subtotal: line.subtotal,
          gstAmount: line.gstAmount,
          total: line.total,
        };
      })
    );
  }

  function removeItem(productId) {
    setItems((current) => current.filter((item) => item.productId !== productId));
    focusSearch();
  }

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const taxAmount = items.reduce((sum, item) => sum + item.gstAmount, 0);
  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);
  const lowStockMatches = filteredProducts.filter((product) => product.stock <= 5).slice(0, 3);

  async function handleInvoiceSubmit() {
    if (!catalogLoaded || !products.length) {
      setError("Products are not available in billing yet. Refresh the catalog and try again.");
      return;
    }

    if (!customer.customerName.trim()) {
      setError("Customer name is required.");
      return;
    }

    if (!items.length) {
      setError("Add at least one product to create an invoice.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: customer.customerName,
          customerPhone: customer.customerPhone,
          gstRate: 0,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            gstRate: item.gstRate,
          })),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const details = payload?.details?.fieldErrors
          ? Object.values(payload.details.fieldErrors).flat().filter(Boolean).join(" ")
          : "";
        throw new Error(details || payload.error || "Unable to create invoice.");
      }

      setSuccess(`Invoice ${payload.invoice.invoiceNumber} created successfully.`);
      pushToast({
        title: "Invoice created",
        description: `${payload.invoice.invoiceNumber} has been created successfully.`,
        tone: "success",
      });
      setItems([]);
      setCustomer({ customerName: "", customerPhone: "" });
      setSelectedProduct(null);
      setQuery("");
      setQuantity("1");
      focusSearch();
    } catch (submitError) {
      const message = submitError.message || "Unable to create invoice.";
      setError(message);
      pushToast({
        title: "Invoice failed",
        description: message,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      eyebrow="Counter Mode"
      title="Billing"
      description="Fast POS-style invoice creation with keyboard-first item entry, live stock awareness, and real-time totals."
      actions={
        <button
          type="button"
          onClick={focusSearch}
          className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Focus Search
        </button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Line Items" value={items.length} hint="Products currently on invoice" tone="cyan" />
        <StatCard label="Subtotal" value={formatCurrency(subtotal)} hint="Before tax and charges" />
        <StatCard label="Grand Total" value={formatCurrency(grandTotal)} hint="Ready to bill" tone="amber" />
      </div>

      {lowStockMatches.length ? (
        <AlertBanner
          title="Counter alert"
          description={`${lowStockMatches.map((product) => product.name).join(", ")} ${
            lowStockMatches.length === 1 ? "is" : "are"
          } running low.`}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Panel className="bg-slate-950 text-white">
            <SectionHeading
              title="Quick Add"
              description="Search a part, confirm quantity, press Enter, and keep moving."
            />
            <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.5fr_auto]">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
                  Product Search
                </span>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedProduct(null);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-4 text-base text-white outline-none ring-0 placeholder:text-slate-400 focus:border-cyan-400"
                  placeholder="Type product name, SKU, or brand"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
                  Quantity
                </span>
                <input
                  ref={quantityRef}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  onKeyDown={handleQuantityKeyDown}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-4 text-base text-white outline-none placeholder:text-slate-400 focus:border-cyan-400"
                  placeholder="1"
                />
              </label>
              <button
                type="button"
                onClick={addItem}
                className="mt-6 rounded-2xl bg-cyan-400 px-5 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Add Item
              </button>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/5">
              {loading ? (
                <div className="grid gap-3 p-4">
                  <LoadingCard className="border-white/10 bg-white/5" lines={2} />
                  <LoadingCard className="border-white/10 bg-white/5" lines={2} />
                </div>
              ) : error && !products.length ? (
                <div className="px-4 py-5 text-sm text-rose-300">
                  {error}
                </div>
              ) : filteredProducts.length ? (
                filteredProducts.map((product, index) => {
                  const active = index === activeIndex;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => selectProduct(product)}
                      className={`grid w-full grid-cols-[1.4fr_0.6fr_0.7fr] items-center gap-3 px-4 py-3 text-left text-sm transition ${
                        active ? "bg-cyan-400 text-slate-950" : "text-slate-200 hover:bg-white/8"
                      }`}
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className={`text-xs ${active ? "text-slate-700" : "text-slate-400"}`}>
                          {product.sku || "No SKU"}
                        </p>
                      </div>
                      <span>{product.stock} pcs</span>
                      <span className="text-right">{formatCurrency(product.unitPrice)}</span>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-5 text-sm text-slate-400">
                  No matching products found.
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
              <span>Arrow keys to move</span>
              <span>Enter to select</span>
              <span>Enter on quantity to add</span>
            </div>
          </Panel>

          <Panel>
            <SectionHeading
              title="Invoice Preview"
              description="Live invoice sheet for the current sale before you commit it."
            />
            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-200">
              <div className="grid grid-cols-[1.2fr_0.5fr_0.7fr_0.55fr_0.7fr_0.75fr_0.3fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <span>Item</span>
                <span>Qty</span>
                <span>Price</span>
                <span>GST%</span>
                <span>GST Amt</span>
                <span>Total</span>
                <span></span>
              </div>
              <div className="divide-y divide-slate-200">
                {items.length ? (
                  items.map((item) => (
                    <div
                      key={item.productId}
                      className="grid grid-cols-[1.2fr_0.5fr_0.7fr_0.55fr_0.7fr_0.75fr_0.3fr] gap-3 px-4 py-4 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-950">{item.name}</p>
                        <p className="text-slate-500">{item.sku || "No SKU"}</p>
                      </div>
                      <input
                        value={item.quantity}
                        onChange={(event) => updateItemQuantity(item.productId, event.target.value)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                      />
                      <p className="py-2 text-slate-700">{formatCurrency(item.unitPrice)}</p>
                      <input
                        value={item.gstRate}
                        onChange={(event) => updateItemGstRate(item.productId, event.target.value)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                      />
                      <p className="py-2 text-slate-700">{formatCurrency(item.gstAmount)}</p>
                      <p className="py-2 font-semibold text-slate-950">{formatCurrency(item.total)}</p>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="rounded-xl px-2 py-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        x
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-10 text-center text-sm text-slate-500">
                    Start typing in the search box to add your first item.
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <SectionHeading
              title="Customer"
              description="Minimal details to keep checkout moving."
            />
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Customer name</span>
                <input
                  value={customer.customerName}
                  onChange={(event) =>
                    setCustomer((current) => ({ ...current, customerName: event.target.value }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500"
                  placeholder="Walk-in customer"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Phone</span>
                <input
                  value={customer.customerPhone}
                  onChange={(event) =>
                    setCustomer((current) => ({ ...current, customerPhone: event.target.value }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500"
                  placeholder="Optional"
                />
              </label>
            </div>
          </Panel>

          <Panel className="bg-gradient-to-br from-slate-950 to-slate-800 text-white">
            <SectionHeading title="Totals" description="Ready-to-bill summary with no extra clicks." />
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Total GST</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xl font-semibold">
                <span>Grand Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
            {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
            {success ? <p className="mt-4 text-sm text-emerald-300">{success}</p> : null}
            <button
              type="button"
              onClick={handleInvoiceSubmit}
              disabled={saving}
              className="mt-6 w-full rounded-2xl bg-cyan-400 px-4 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {saving ? "Creating invoice..." : "Create Invoice"}
            </button>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
