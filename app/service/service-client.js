"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast-provider";

function fmt(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

const initialForm = { customerName: "", customerPhone: "", deviceName: "", deviceModel: "", complaint: "", serviceCharge: "0" };

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500">{label}</span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-1.5 w-full border border-slate-200 rounded-sm px-3 py-2.5 text-sm font-mono text-slate-900 outline-none focus:border-slate-900 bg-white placeholder:text-slate-300 transition-colors"
      />
    </label>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="border border-slate-200 rounded-sm px-5 py-4 bg-white">
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 mb-1">{label}</p>
      <p className="text-xl font-semibold text-slate-900 font-mono tracking-tight">{value}</p>
      {sub && <p className="text-xs font-mono text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ServiceClient() {
  const { pushToast } = useToast();
  const [products, setProducts] = useState([]);
  const [parts, setParts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [partSearch, setPartSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/products")
      .then((r) => r.json())
      .then((payload) => { if (active) setProducts(payload.products || []); })
      .catch((e) => { if (active) { setError(e.message); pushToast({ title: "Parts unavailable", description: e.message, tone: "error" }); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pushToast]);

  const selectedParts = useMemo(() =>
    parts.map((part) => {
      const product = products.find((p) => p.id === part.productId);
      const qty = Number(part.quantity || 0);
      if (!product || !qty) return null;
      return { ...product, quantity: qty, total: Number(product.unitPrice) * qty };
    }).filter(Boolean),
    [parts, products]
  );

  const partsTotal = selectedParts.reduce((s, p) => s + p.total, 0);
  const labour = Number(form.serviceCharge || 0);
  const totalCharge = partsTotal + labour;

  const lowStock = products.filter((p) => p.stock <= 5).slice(0, 4);
  const filteredCatalog = products.filter((p) =>
    [p.name, p.sku, p.brand?.name].filter(Boolean).join(" ").toLowerCase().includes(partSearch.trim().toLowerCase())
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items: selectedParts.map((p) => ({ productId: p.id, quantity: p.quantity })) }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Unable to create service job.");
      setForm(initialForm); setParts([]);
      setSuccess(`Job ${payload.serviceJob.jobNumber} created.`);
      pushToast({ title: "Service job created", description: payload.serviceJob.jobNumber, tone: "success" });
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Job failed", description: e.message, tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 pb-5 mb-6">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-1">Workshop Flow</p>
          <h1 className="text-xl font-semibold text-slate-900">Service</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Parts Lines" value={parts.length} sub="On current job" />
        <Stat label="Parts Total" value={fmt(partsTotal)} sub="Material cost" />
        <Stat label="Total Estimate" value={fmt(totalCharge)} sub="Labour + parts" />
      </div>

      {lowStock.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-sm px-4 py-2.5 mb-6 text-xs font-mono text-amber-700">
          ⚠ Low stock: {lowStock.map((p) => p.name).join(", ")}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Service job form */}
        <div className="border border-slate-200 rounded-sm bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-900 font-semibold mb-4">New Service Job</p>
          <form className="space-y-3" onSubmit={handleSubmit}>
            {[
              ["customerName", "Customer name"],
              ["customerPhone", "Phone"],
              ["deviceName", "Vehicle / device name"],
              ["deviceModel", "Model"],
              ["serviceCharge", "Labour charge (₹)"],
            ].map(([field, label]) => (
              <Field key={field} label={label} value={form[field]} onChange={(e) => setForm((c) => ({ ...c, [field]: e.target.value }))} placeholder={label} />
            ))}
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500">Complaint</span>
              <textarea
                value={form.complaint}
                onChange={(e) => setForm((c) => ({ ...c, complaint: e.target.value }))}
                placeholder="Describe the issue"
                className="mt-1.5 w-full border border-slate-200 rounded-sm px-3 py-2.5 text-sm font-mono text-slate-900 outline-none focus:border-slate-900 bg-white placeholder:text-slate-300 transition-colors min-h-20 resize-none"
              />
            </label>
            {error && <p className="text-xs font-mono text-rose-600">{error}</p>}
            {success && <p className="text-xs font-mono text-emerald-600">{success}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-slate-900 text-white text-xs font-mono py-3 rounded-sm hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {saving ? "creating..." : "create service job →"}
            </button>
          </form>
        </div>

        {/* Parts panel */}
        <div className="border border-slate-200 rounded-sm bg-white p-5">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-900 font-semibold">Parts Used</p>
            <div className="flex gap-2">
              <input
                value={partSearch}
                onChange={(e) => setPartSearch(e.target.value)}
                placeholder="Search parts..."
                className="border border-slate-200 rounded-sm px-3 py-2 text-xs font-mono text-slate-900 outline-none focus:border-slate-900 bg-white placeholder:text-slate-300"
              />
              <button
                type="button"
                onClick={() => setParts((c) => [...c, { productId: "", quantity: "1" }])}
                className="border border-slate-900 text-slate-900 text-xs font-mono px-3 py-2 rounded-sm hover:bg-slate-900 hover:text-white transition-colors whitespace-nowrap"
              >
                + add part
              </button>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-sm animate-pulse" />)}
              </div>
            ) : parts.length ? (
              parts.map((part, idx) => (
                <div key={`${idx}-${part.productId}`} className="border border-slate-100 rounded-sm p-3 space-y-2">
                  <select
                    value={part.productId}
                    onChange={(e) => setParts((c) => c.map((p, i) => i === idx ? { ...p, productId: e.target.value } : p))}
                    className="w-full border border-slate-200 rounded-sm px-3 py-2 text-xs font-mono text-slate-900 outline-none focus:border-slate-900 bg-white"
                  >
                    <option value="">Select part</option>
                    {filteredCatalog.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {p.stock} in stock</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      value={part.quantity}
                      onChange={(e) => setParts((c) => c.map((p, i) => i === idx ? { ...p, quantity: e.target.value } : p))}
                      placeholder="Qty"
                      className="flex-1 border border-slate-200 rounded-sm px-3 py-2 text-xs font-mono text-slate-900 outline-none focus:border-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setParts((c) => c.filter((_, i) => i !== idx))}
                      className="border border-slate-200 rounded-sm px-3 py-2 text-xs font-mono text-slate-500 hover:border-rose-200 hover:text-rose-500 transition-colors"
                    >
                      remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="border border-dashed border-slate-200 rounded-sm px-4 py-8 text-xs font-mono text-slate-400 text-center">
                No parts added yet.
              </div>
            )}
          </div>

          {/* Estimate summary */}
          <div className="border border-slate-100 rounded-sm bg-slate-50 p-4 space-y-2">
            <div className="flex justify-between text-xs font-mono text-slate-500">
              <span>Parts</span><span>{fmt(partsTotal)}</span>
            </div>
            <div className="flex justify-between text-xs font-mono text-slate-500">
              <span>Labour</span><span>{fmt(labour)}</span>
            </div>
            <div className="flex justify-between text-sm font-mono font-semibold text-slate-900 border-t border-slate-200 pt-2">
              <span>Total estimate</span><span>{fmt(totalCharge)}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}