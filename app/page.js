import Link from "next/link";

const sections = [
  {
    href: "/dashboard",
    title: "Dashboard",
    description: "Track totals, invoices, and daily activity from one place.",
  },
  {
    href: "/products",
    title: "Products",
    description: "Manage billable items and keep pricing organized.",
  },
  {
    href: "/billing",
    title: "Billing",
    description: "Create invoices, review payments, and follow balances.",
  },
  {
    href: "/service",
    title: "Service",
    description: "Coordinate support work and service-based requests.",
  },
  {
    href: "/reports",
    title: "Reports",
    description: "Review business summaries and export-ready reporting views.",
  },
  {
    href: "/login",
    title: "Login",
    description: "Use the auth entry point prepared for protected routes.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-12 sm:px-10">
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          Phase 1 Setup
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Billing system foundation with Next.js, Tailwind, Prisma, and MySQL.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          The project structure is ready for authentication, product management,
          billing flows, service requests, and reporting.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-cyan-300 hover:shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {section.title}
              </h2>
              <span className="text-cyan-700 transition group-hover:translate-x-1">
                {"->"}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {section.description}
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}
