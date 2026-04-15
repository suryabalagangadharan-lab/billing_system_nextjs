import {
  createForbiddenResponse,
  createUnauthorizedResponse,
  extractTokenFromRequest,
  verifyAuthToken,
} from "@/lib/auth";
import { matchRouteRule } from "@/lib/access";
import { NextResponse } from "next/server";

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const matchedRule = matchRouteRule(pathname);

  if (!matchedRule) {
    return NextResponse.next();
  }

  const token = extractTokenFromRequest(request);

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return createUnauthorizedResponse();
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const session = await verifyAuthToken(token);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return createUnauthorizedResponse();
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!matchedRule.roles.includes(session.role)) {
    if (pathname.startsWith("/api/")) {
      return createForbiddenResponse();
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
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
    "/api/reports/:path*",
  ],
};
