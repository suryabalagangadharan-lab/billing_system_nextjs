export const routeRules = [
  { prefix: "/dashboard", roles: ["admin", "employee"] },
  { prefix: "/products", roles: ["admin", "employee"] },
  { prefix: "/billing", roles: ["admin", "employee"] },
  { prefix: "/purchases", roles: ["admin", "employee"] },
  { prefix: "/service", roles: ["admin", "employee"] },
  { prefix: "/reports", roles: ["admin"] },
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
  "/purchases/:path*",
  "/service/:path*",
  "/reports/:path*",
];
