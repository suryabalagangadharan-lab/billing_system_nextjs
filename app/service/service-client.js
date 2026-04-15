"use client";

import { useEffect, useMemo, useState } from "react";
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
  customerName: "",
  customerPhone: "",
  deviceName: "",
  deviceModel: "",
  complaint: "",
  serviceCharge: "0",
};

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

    async function loadProducts() {
      try {
        const response = await fetch("/api/products");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load parts catalog.");
        }

        if (active) {
          setProducts(payload.products || []);
        }
      } catch (loadError) {
        if (active) {
          const message = loadError.message || "Unable to load parts catalog.";
          setError(message);
          pushToast({
            title: "Parts unavailable",
            description: message,
            tone: "error",
          });
        }
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

  function addPart() {
    setParts((current) => [...current, { productId: "", quantity: "1" }]);
  }

  function updatePart(index, field, value) {
    setParts((current) =>
      current.map((part, currentIndex) =>
        currentIndex === index ? { ...part, [field]: value } : part
      )
    );
  }

  function removePart(index) {
    setParts((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  const selectedParts = useMemo(
    () =>
      parts
        .map((part) => {
          const product = products.find((candidate) => candidate.id === part.productId);
          const quantity = Number(part.quantity || 0);

          if (!product || !quantity) {
            return null;
          }

          return {
            ...product,
            quantity,
            total: Number(product.unitPrice) * quantity,
          };
        })
        .filter(Boolean),
    [parts, products]
  );

  const partsTotal = selectedParts.reduce((sum, item) => sum + item.total, 0);
  const labourCharge = Number(form.serviceCharge || 0);
  const totalCharge = partsTotal + labourCharge;
  const lowStockParts = products.filter((product) => product.stock <= 5).slice(0, 4);
  const filteredPartsCatalog = products.filter((product) =>
    [product.name, product.sku, product.brand?.name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(partSearch.trim().toLowerCase())
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/service", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          items: selectedParts.map((part) => ({
            productId: part.id,
            quantity: part.quantity,
          })),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to create service job.");
      }

      setForm(initialForm);
      setParts([]);
      setSuccess(`Service job ${payload.serviceJob.jobNumber} created successfully.`);
      pushToast({
        title: "Service job created",
        description: `${payload.serviceJob.jobNumber} is ready for workshop processing.`,
        tone: "success",
      });
    } catch (submitError) {
      const message = submitError.message || "Unable to create service job.";
      setError(message);
      pushToast({
        title: "Service job failed",
        description: message,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      eyebrow="Workshop Flow"
      title="Service"
      description="Create repair jobs fast, attach parts used, and keep labour charges visible before the work begins."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Parts Lines" value={parts.length} hint="Items attached to current job" tone="cyan" />
        <StatCard label="Parts Total" value={formatCurrency(partsTotal)} hint="Material consumption" />
        <StatCard label="Total Charge" value={formatCurrency(totalCharge)} hint="Labour plus parts" tone="amber" />
      </div>

      {lowStockParts.length ? (
        <AlertBanner
          title="Workshop stock alert"
          description={`${lowStockParts.map((product) => product.name).join(", ")} ${
            lowStockParts.length === 1 ? "is" : "are"
          } nearly out of stock.`}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Panel>
          <SectionHeading title="New Service Job" description="Capture the repair request and attach parts in one flow." />
          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            {[
              ["customerName", "Customer name"],
              ["customerPhone", "Customer phone"],
              ["deviceName", "Vehicle / device name"],
              ["deviceModel", "Model"],
              ["serviceCharge", "Labour charge"],
            ].map(([field, label]) => (
              <label key={field} className="block">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <input
                  value={form[field]}
                  onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500"
                  placeholder={label}
                />
              </label>
            ))}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Complaint</span>
              <textarea
                value={form.complaint}
                onChange={(event) => setForm((current) => ({ ...current, complaint: event.target.value }))}
                className="mt-2 min-h-28 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500"
                placeholder="Describe the issue"
              />
            </label>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create Service Job"}
            </button>
          </form>
        </Panel>

        <Panel>
          <SectionHeading
            title="Parts Used"
            description="Attach billable parts and keep the job estimate transparent."
            action={
              <div className="flex flex-wrap gap-3">
                <input
                  value={partSearch}
                  onChange={(event) => setPartSearch(event.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-cyan-500"
                  placeholder="Search parts"
                />
                <button
                  type="button"
                  onClick={addPart}
                  className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950"
                >
                  Add Part
                </button>
              </div>
            }
          />
          <div className="mt-5 space-y-4">
            {loading ? (
              <div className="grid gap-3">
                <LoadingCard lines={2} />
                <LoadingCard lines={2} />
              </div>
            ) : parts.length ? (
              parts.map((part, index) => (
                <div key={`${index}-${part.productId}`} className="grid gap-3 rounded-[1.5rem] border border-slate-200 p-4">
                  <select
                    value={part.productId}
                    onChange={(event) => updatePart(index, "productId", event.target.value)}
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500"
                  >
                    <option value="">Select part</option>
                    {filteredPartsCatalog.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.stock} in stock)
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <input
                      value={part.quantity}
                      onChange={(event) => updatePart(index, "quantity", event.target.value)}
                      className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500"
                      placeholder="Quantity"
                    />
                    <button
                      type="button"
                      onClick={() => removePart(index)}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 px-4 py-8 text-sm text-slate-500">
                No parts added yet.
              </div>
            )}
          </div>

          <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Parts total</span>
              <span>{formatCurrency(partsTotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
              <span>Labour</span>
              <span>{formatCurrency(labourCharge)}</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-lg font-semibold text-slate-950">
              <span>Total estimate</span>
              <span>{formatCurrency(totalCharge)}</span>
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
