"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/billing", label: "Billing" },
  { href: "/purchases", label: "Purchases" },
  { href: "/service", label: "Service" },
  { href: "/reports", label: "Reports" },
  { href: "/invoices", label: "Invoices" },
];

function isActivePath(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function FloatingNavbar({ children }) {
  const pathname = usePathname();

  if (pathname === "/billing") {
    return children;
  }

  return (
    <>
      <div className="fixed inset-x-0 top-4 z-[60] flex justify-center px-4 print:hidden">
        <div className="flex w-full max-w-5xl items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 no-underline transition-colors hover:bg-slate-300"
          >
            <span className="h-2 w-2 rounded-full bg-cyan-300" />
            <span className="text-[13px] font-semibold tracking-wide">Sri Krishna Automobiles</span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto px-1 sm:justify-center">
            {navigation.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-full px-4 py-2 text-[13px] text-slate-900 no-underline transition-colors ${
                    active
                      ? "bg-slate-200 text-slate-900"
                      : "text-slate-900 hover:bg-slate-300 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="pt-24 sm:pt-28 print:pt-0">{children}</div>
    </>
  );
}
