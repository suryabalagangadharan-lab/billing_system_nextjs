export const routeRules = [
  { prefix: "/dashboard", roles: ["admin", "employee"] },
  { prefix: "/products", roles: ["admin", "employee"] },
  { prefix: "/billing", roles: ["admin", "employee"] },
  { prefix: "/service", roles: ["admin", "employee"] },
  { prefix: "/reports", roles: ["admin"] },
  { prefix: "/api/products", roles: ["admin", "employee"] },
  { prefix: "/api/purchase", roles: ["admin", "employee"] },
  { prefix: "/api/invoices", roles: ["admin", "employee"] },
  { prefix: "/api/billing", roles: ["admin", "employee"] },
  { prefix: "/api/service", roles: ["admin", "employee"] },
  { prefix: "/api/customers", roles: ["admin", "employee"] },
  { prefix: "/api/reports", roles: ["admin"] },
];

export function matchRouteRule(pathname) {
  return routeRules.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)
  );
}

export const protectedRouteMatchers = [
  "/dashboard/:path*",
  "/products/:path*",
  "/billing/:path*",
  "/service/:path*",
  "/reports/:path*",
  "/api/products/:path*",
  "/api/purchase/:path*",
  "/api/invoices/:path*",
  "/api/billing/:path*",
  "/api/service/:path*",
  "/api/customers/:path*",
  "/api/reports/:path*",
];
