"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast-provider";

function fmt(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function isoDate(value = new Date()) {
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const initialForm = {
  customerName: "",
  customerPhone: "",
  deviceName: "",
  deviceModel: "",
  complaint: "",
  serviceCharge: "0",
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
      <Input type={type} value={value} onChange={onChange} placeholder={placeholder} />
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

function StatusBadge({ status }) {
  const map = {
    completed:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    delivered:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    in_progress:"bg-blue-50 text-blue-700 border-blue-200",
    pending:    "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full border ${map[status] || map.pending}`}>
      {status?.replace("_", " ") || "pending"}
    </span>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ServiceClient() {
  const { pushToast } = useToast();
  const [products, setProducts] = useState([]);
  const [serviceJobs, setServiceJobs] = useState([]);
  const [chargePresets, setChargePresets] = useState([]);
  const [parts, setParts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [partSearch, setPartSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [deletingPresetId, setDeletingPresetId] = useState("");
  const [error, setError] = useState("");
  const [expandedJob, setExpandedJob] = useState(null);
  const [presetForm, setPresetForm] = useState({ name: "", amount: "" });
  const [editingPresetId, setEditingPresetId] = useState("");

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetch("/api/products", { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
      fetch("/api/service",  { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
      fetch("/api/service-charge-presets", { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    ]).then(([pResult, sResult, cResult]) => {
      if (!active) return;
      if (pResult.status === "fulfilled") setProducts(pResult.value.products || []);
      else pushToast({ title: "Parts unavailable", description: pResult.reason?.message, tone: "error" });
      if (sResult.status === "fulfilled") setServiceJobs(sResult.value.serviceJobs || []);
      else pushToast({ title: "Service list unavailable", description: sResult.reason?.message, tone: "error" });
      if (cResult.status === "fulfilled") setChargePresets(cResult.value.presets || []);
      else pushToast({ title: "Presets unavailable", description: cResult.reason?.message, tone: "error" });
    }).finally(() => { if (active) setLoading(false); });
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

  const lowStock = products.filter((p) => p.stock <= 5 && p.stock > 0).slice(0, 5);

  const filteredCatalog = useMemo(() =>
    products.filter((p) =>
      [p.name, p.sku, p.brand?.name].filter(Boolean).join(" ").toLowerCase().includes(partSearch.trim().toLowerCase())
    ), [products, partSearch]
  );

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    return serviceJobs.filter((job) => {
      const matchSearch = !q || [job.jobNumber, job.customerName, job.customerPhone, job.deviceName, job.deviceModel, job.status, job.complaint, job.diagnosis]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" ? true :
        statusFilter === "done" ? ["completed", "delivered"].includes(job.status) : job.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [serviceJobs, serviceSearch, statusFilter]);

  const jobStats = useMemo(() => ({
    total: serviceJobs.length,
    pending: serviceJobs.filter((j) => j.status === "pending").length,
    inProgress: serviceJobs.filter((j) => j.status === "in_progress").length,
    done: serviceJobs.filter((j) => ["completed", "delivered"].includes(j.status)).length,
  }), [serviceJobs]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.customerName.trim()) return setError("Customer name is required.");
    if (!form.deviceName.trim()) return setError("Device name is required.");
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items: selectedParts.map((p) => ({ productId: p.id, quantity: p.quantity })) }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Unable to create service job.");
      setForm(initialForm);
      setParts([]);
      setServiceJobs((cur) => [payload.serviceJob, ...cur].filter(Boolean));
      pushToast({ title: "Service job created", description: payload.serviceJob.jobNumber, tone: "success" });
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Job failed", description: e.message, tone: "error" });
    } finally { setSaving(false); }
  }

  async function handleSavePreset(e) {
    e.preventDefault();
    const name = presetForm.name.trim();
    const amount = presetForm.amount.trim();

    if (!name) return setError("Preset name is required.");
    if (!amount || Number(amount) < 0) return setError("Preset amount must be a valid number.");

    setSavingPreset(true);
    setError("");
    try {
      const isEditing = Boolean(editingPresetId);
      const res = await fetch(
        isEditing ? `/api/service-charge-presets/${editingPresetId}` : "/api/service-charge-presets",
        {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, amount }),
        }
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Unable to save preset.");
      setChargePresets((cur) => {
        const next = isEditing
          ? cur.map((preset) => (preset.id === editingPresetId ? payload.preset : preset))
          : [...cur, payload.preset];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setPresetForm({ name: "", amount: "" });
      setEditingPresetId("");
      pushToast({
        title: isEditing ? "Preset updated" : "Preset created",
        description: `${payload.preset.name} saved.`,
        tone: "success",
      });
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Could not save preset", description: e.message, tone: "error" });
    } finally {
      setSavingPreset(false);
    }
  }

  function handleEditPreset(preset) {
    setEditingPresetId(preset.id);
    setPresetForm({
      name: preset.name || "",
      amount: String(preset.amount || ""),
    });
  }

  function handleCancelPresetEdit() {
    setEditingPresetId("");
    setPresetForm({ name: "", amount: "" });
    setError("");
  }

  async function handleDeletePreset(id) {
    setDeletingPresetId(id);
    setError("");
    try {
      const res = await fetch(`/api/service-charge-presets/${id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Unable to delete preset.");
      setChargePresets((cur) => cur.filter((preset) => preset.id !== id));
      pushToast({ title: "Preset deleted", description: payload.name || "Removed.", tone: "success" });
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Could not delete preset", description: e.message, tone: "error" });
    } finally {
      setDeletingPresetId("");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top bar ── */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-screen-xl mx-auto px-6 h-[52px] flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-[15px] font-medium text-slate-900">OpsHub</span>
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-[14px] font-medium text-slate-900">Service</span>
          </div>
          <div className="flex-1" />
          <span className="text-[13px] text-slate-400">{jobStats.total} jobs · {jobStats.pending} pending</span>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6 pt-6 pb-2">
        <h1 className="text-[19px] font-medium text-slate-900">Workshop flow</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Create service jobs, track parts used, and manage the service register.</p>
      </div>

      {/* ── Stats ── */}
      <div className="max-w-screen-xl mx-auto px-6 pt-4 pb-2">
        <div className="grid grid-cols-4 bg-white border border-slate-200 rounded-xl overflow-hidden divide-x divide-slate-100">
          {[
            { label: "Total Jobs", value: loading ? "—" : jobStats.total, sub: "All time" },
            { label: "Pending", value: loading ? "—" : jobStats.pending, sub: "Awaiting work", warn: jobStats.pending > 0 },
            { label: "In Progress", value: loading ? "—" : jobStats.inProgress, sub: "Active jobs", blue: jobStats.inProgress > 0 },
            { label: "Completed", value: loading ? "—" : jobStats.done, sub: "Closed & delivered" },
          ].map(({ label, value, sub, warn, blue }) => (
            <div key={label} className={`px-5 py-4 ${warn ? "bg-amber-50" : blue ? "bg-blue-50" : ""}`}>
              <p className={`text-[13px] font-medium tracking-wide uppercase mb-1 ${warn ? "text-amber-600" : blue ? "text-blue-600" : "text-slate-400"}`}>{label}</p>
              <p className={`text-[20px] font-medium ${warn ? "text-amber-700" : blue ? "text-blue-700" : "text-slate-900"}`}>{value}</p>
              <p className={`text-[12px] mt-0.5 ${warn ? "text-amber-500" : blue ? "text-blue-400" : "text-slate-400"}`}>{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Low stock alert ── */}
      {lowStock.length > 0 && (
        <div className="max-w-screen-xl mx-auto px-6 pt-3">
          <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 text-[13px] text-amber-700 flex items-center gap-2 flex-wrap">
            <span>⚠</span>
            <span>Low stock on parts:</span>
            <span className="font-medium">{lowStock.map((p) => p.name).join(", ")}</span>
          </div>
        </div>
      )}

      {/* ── Main two-column layout ── */}
      <div className="max-w-screen-xl mx-auto px-6 pt-4 pb-4 grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* ── LEFT: New service job form ── */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <CardHeader title="Customer & device" subtitle="Who brought it in and what is it?" />
            <div className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Customer name *" value={form.customerName} onChange={(e) => setForm((c) => ({ ...c, customerName: e.target.value }))} placeholder="Full name" />
                <Field label="Phone" value={form.customerPhone} onChange={(e) => setForm((c) => ({ ...c, customerPhone: e.target.value }))} placeholder="+91 98765…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Device / vehicle *" value={form.deviceName} onChange={(e) => setForm((c) => ({ ...c, deviceName: e.target.value }))} placeholder="e.g. Honda Activa" />
                <Field label="Model / variant" value={form.deviceModel} onChange={(e) => setForm((c) => ({ ...c, deviceModel: e.target.value }))} placeholder="e.g. 6G DLX" />
              </div>
              <div>
                <Label>Complaint</Label>
                <textarea
                  value={form.complaint}
                  onChange={(e) => setForm((c) => ({ ...c, complaint: e.target.value }))}
                  placeholder="Describe the issue in detail…"
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-slate-400 transition-colors placeholder:text-slate-300 resize-none"
                />
              </div>
              <div className="w-1/2">
                <Field label="Labour charge (₹)" type="number" value={form.serviceCharge} onChange={(e) => setForm((c) => ({ ...c, serviceCharge: e.target.value }))} placeholder="0" />
              </div>
            </div>
          </div>

          {error && (
            <div className="border border-red-100 bg-red-50 rounded-xl px-4 py-3 text-[13px] text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="text-[13px] font-medium py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            {saving ? "Creating job…" : "Create service job →"}
          </button>
        </form>

        {/* ── RIGHT: Parts panel ── */}
        <div className="flex flex-col gap-4">

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <CardHeader
              title="Parts used"
              subtitle={`${selectedParts.length} part${selectedParts.length !== 1 ? "s" : ""} · ${fmt(partsTotal)}`}
              action={
                <button
                  type="button"
                  onClick={() => setParts((c) => [...c, { productId: "", quantity: "1" }])}
                  className="text-[13px] font-medium px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  + Add part
                </button>
              }
            />

            {/* Part search */}
            {parts.length > 0 && (
              <div className="px-5 pt-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none text-[14px]">⌕</span>
                  <Input
                    value={partSearch}
                    onChange={(e) => setPartSearch(e.target.value)}
                    placeholder="Filter catalog…"
                    className="pl-8"
                  />
                </div>
              </div>
            )}

            <div className="p-5 flex flex-col gap-3">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                ))
              ) : parts.length ? (
                parts.map((part, idx) => {
                  const product = products.find((p) => p.id === part.productId);
                  const lineTotal = product ? Number(product.unitPrice) * Number(part.quantity || 0) : 0;
                  return (
                    <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[12px] font-medium text-slate-400 uppercase tracking-wide">Part {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => setParts((c) => c.filter((_, i) => i !== idx))}
                          className="text-[13px] text-slate-300 hover:text-red-500 transition-colors"
                        >
                          ✕ Remove
                        </button>
                      </div>
                      <Select
                        value={part.productId}
                        onChange={(e) => setParts((c) => c.map((p, i) => i === idx ? { ...p, productId: e.target.value } : p))}
                        className="mb-3"
                      >
                        <option value="">Select part…</option>
                        {filteredCatalog.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} — {p.stock} in stock</option>
                        ))}
                      </Select>
                      <div className="flex items-center gap-3">
                        <div className="w-28">
                          <Label>Qty</Label>
                          <Input
                            type="number"
                            value={part.quantity}
                            onChange={(e) => setParts((c) => c.map((p, i) => i === idx ? { ...p, quantity: e.target.value } : p))}
                            placeholder="1"
                          />
                        </div>
                        {product && (
                          <div className="flex-1 text-right">
                            <p className="text-[12px] text-slate-400">{fmt(product.unitPrice)} × {part.quantity || 0}</p>
                            <p className="text-[15px] font-medium text-slate-900">{fmt(lineTotal)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="border border-dashed border-slate-200 rounded-xl py-10 text-center">
                  <p className="text-[14px] text-slate-300 mb-2">No parts added yet</p>
                  <p className="text-[13px] text-slate-300">Click the Add part button to include parts from inventory</p>
                </div>
              )}
            </div>

            {/* Estimate summary */}
            <div className="mx-5 mb-5 border border-slate-100 rounded-xl overflow-hidden">
              <div className="grid grid-cols-3 divide-x divide-slate-100">
                {[
                  { label: "Parts", value: fmt(partsTotal) },
                  { label: "Labour", value: fmt(labour) },
                  { label: "Total", value: fmt(totalCharge), dark: true },
                ].map(({ label, value, dark }) => (
                  <div key={label} className={`px-4 py-3 ${dark ? "bg-slate-900" : "bg-slate-50"}`}>
                    <p className={`text-[12px] font-medium uppercase tracking-wide mb-1 ${dark ? "text-slate-400" : "text-slate-400"}`}>{label}</p>
                    <p className={`text-[14px] font-medium ${dark ? "text-white" : "text-slate-900"}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <CardHeader
              title="Service charge presets"
              subtitle="Create reusable charges for billing and service jobs."
            />
            <form onSubmit={handleSavePreset} className="p-5 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Preset name</Label>
                  <Input
                    value={presetForm.name}
                    onChange={(e) => setPresetForm((c) => ({ ...c, name: e.target.value }))}
                    placeholder="e.g. Screen replacement"
                  />
                </div>
                <div>
                  <Label>Amount (₹)</Label>
                  <Input
                    type="number"
                    value={presetForm.amount}
                    onChange={(e) => setPresetForm((c) => ({ ...c, amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingPreset}
                className="text-[13px] font-medium px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {savingPreset ? "Saving..." : editingPresetId ? "Update preset" : "Add preset"}
              </button>
              {editingPresetId && (
                <button
                  type="button"
                  onClick={handleCancelPresetEdit}
                  className="text-[13px] font-medium px-4 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancel edit
                </button>
              )}
            </form>
            <div className="border-t border-slate-100">
              {chargePresets.length ? (
                chargePresets.map((preset) => (
                  <div key={preset.id} className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-[14px] font-medium text-slate-900">{preset.name}</p>
                      <p className="text-[13px] text-slate-400">{fmt(preset.amount)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleEditPreset(preset)}
                        className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePreset(preset.id)}
                        disabled={deletingPresetId === preset.id}
                        className="text-[13px] text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        {deletingPresetId === preset.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-5 text-center text-[13px] text-slate-300">
                  No presets created yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Service register ── */}
      <div className="max-w-screen-xl mx-auto px-6 pb-8">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">

          {/* Register toolbar */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-wrap">
            <div>
              <p className="text-[14px] font-medium text-slate-900">Service register</p>
              <p className="text-[13px] text-slate-400">{filteredServices.length} job{filteredServices.length !== 1 ? "s" : ""} shown</p>
            </div>
            <div className="flex-1" />
            <div className="relative w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none text-[14px]">⌕</span>
              <Input
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder="Search jobs…"
                className="pl-8"
              />
            </div>
            <div className="w-40">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="done">Completed</option>
              </Select>
            </div>
          </div>

          {/* Register list */}
          {loading ? (
            <div className="p-5 flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredServices.length ? (
            <div className="divide-y divide-slate-100">
              {filteredServices.map((job) => {
                const isOpen = expandedJob === job.id;
                return (
                  <div key={job.id}>
                    {/* Row summary */}
                    <button
                      type="button"
                      onClick={() => setExpandedJob(isOpen ? null : job.id)}
                      className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="grid gap-3 items-center" style={{ gridTemplateColumns: "1fr 1.2fr 1.2fr 0.8fr auto auto" }}>
                        <div>
                          <p className="text-[14px] font-medium text-slate-900">{job.jobNumber}</p>
                          <p className="text-[13px] text-slate-400">{isoDate(job.createdAt)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] text-slate-900 truncate">{job.customerName}</p>
                          <p className="text-[13px] text-slate-400 truncate">{job.customerPhone || "No phone"}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] text-slate-700 truncate">{job.deviceName}</p>
                          <p className="text-[13px] text-slate-400 truncate">{job.deviceModel || "No model"}</p>
                        </div>
                        <div className="text-[14px] font-medium text-slate-900 whitespace-nowrap">
                          {fmt(job.totalAmount)}
                        </div>
                        <StatusBadge status={job.status} />
                        <span className="text-[13px] text-slate-400">{isOpen ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="px-5 pb-5 bg-slate-50 border-t border-slate-100">
                        <div className="pt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">

                          {/* Left: complaint + parts */}
                          <div className="flex flex-col gap-4">
                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                              <p className="text-[12px] font-medium text-slate-400 uppercase tracking-wide mb-2">Complaint</p>
                              <p className="text-[14px] text-slate-700">{job.complaint || "No complaint recorded."}</p>
                            </div>
                            {job.diagnosis && (
                              <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <p className="text-[12px] font-medium text-slate-400 uppercase tracking-wide mb-2">Diagnosis</p>
                                <p className="text-[14px] text-slate-700">{job.diagnosis}</p>
                              </div>
                            )}
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                              <div className="px-4 py-3 border-b border-slate-100">
                                <p className="text-[13px] font-medium text-slate-900">Parts used</p>
                              </div>
                              {job.items?.length ? (
                                <div className="divide-y divide-slate-100">
                                  {job.items.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between px-4 py-3">
                                      <div>
                                        <p className="text-[14px] font-medium text-slate-900">{item.description}</p>
                                        <p className="text-[13px] text-slate-400">Qty {item.quantity} × {fmt(item.unitPrice)}</p>
                                      </div>
                                      <p className="text-[14px] font-medium text-slate-900">{fmt(item.total)}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="px-4 py-4 text-[13px] text-slate-300">No parts used.</div>
                              )}
                            </div>
                          </div>

                          {/* Right: cost summary */}
                          <div className="flex flex-col gap-4">
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                              <div className="px-4 py-3 border-b border-slate-100">
                                <p className="text-[13px] font-medium text-slate-900">Cost breakdown</p>
                              </div>
                              <div className="p-4 flex flex-col gap-2">
                                {[
                                  { label: "Parts cost", value: fmt(job.partsCost) },
                                  { label: "Labour", value: fmt(job.serviceCharge) },
                                ].map(({ label, value }) => (
                                  <div key={label} className="flex items-center justify-between">
                                    <span className="text-[13px] text-slate-500">{label}</span>
                                    <span className="text-[14px] text-slate-700">{value}</span>
                                  </div>
                                ))}
                                <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
                                  <span className="text-[14px] font-medium text-slate-900">Total estimate</span>
                                  <span className="text-[16px] font-medium text-slate-900">{fmt(job.totalAmount)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                              <p className="text-[12px] font-medium text-slate-400 uppercase tracking-wide mb-2">Assigned to</p>
                              <p className="text-[14px] text-slate-900">{job.assignedTo?.name || "Unassigned"}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-14 text-center">
              <p className="text-[14px] text-slate-300 mb-3">No service jobs found.</p>
              {(serviceSearch || statusFilter !== "all") && (
                <button
                  onClick={() => { setServiceSearch(""); setStatusFilter("all"); }}
                  className="text-[13px] px-4 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
