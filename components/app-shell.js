"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/billing", label: "Billing" },
  { href: "/service", label: "Service" },
  { href: "/reports", label: "Reports" },
];

function isActivePath(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ title, eyebrow, description, actions, children }) {
  const pathname = usePathname();

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-white/60 bg-slate-950 px-5 py-6 text-white shadow-[0_30px_90px_rgba(15,23,42,0.2)]">
          <Link href="/" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-cyan-300">
              Billing OS
            </p>
            <h1 className="mt-2 text-xl font-semibold">Workshop Console</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Inventory, invoices, service jobs, and reporting in one fast workspace.
            </p>
          </Link>

          <nav className="mt-6 space-y-2">
            {navigation.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-cyan-400 text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.35)]"
                      : "bg-white/0 text-slate-300 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`text-xs ${active ? "text-slate-700" : "text-slate-500"}`}>01</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="space-y-6">
          <header className="rounded-[2rem] border border-slate-200/80 bg-white/90 px-6 py-6 shadow-[0_25px_70px_rgba(148,163,184,0.18)] backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.35em] text-cyan-700">
                  {eyebrow}
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
              </div>
              {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
            </div>
          </header>

          <div className="space-y-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
