import { NextRequest, NextResponse } from "next/server";

import { ACTING_CUSTOMER_COOKIE, TOKEN_COOKIE } from "@/lib/auth/cookie-names";
import { decodeAccessToken, homePathForRole, isTokenExpired } from "@/lib/auth/jwt";

const PUBLIC_PATHS = new Set(["/login", "/accept-invite", "/unauthorized"]);

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const claims = token ? decodeAccessToken(token) : null;
  const valid = claims && !isTokenExpired(claims) && claims.status === "active";

  if (pathname === "/" || pathname === "/login") {
    if (valid) {
      const home = homePathForRole(claims.role);
      if (home) return redirectTo(request, home);
    }
    if (pathname === "/") return redirectTo(request, "/login");
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/accept-invite")) {
    return NextResponse.next();
  }

  if (!valid) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (claims?.status === "invited") url.searchParams.set("reason", "invited");
    else if (claims?.status === "suspended") url.searchParams.set("reason", "suspended");
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/platform")) {
    if (claims.role !== "product_admin") {
      return redirectTo(request, "/unauthorized");
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/school")) {
    if (claims.role === "customer_admin") return NextResponse.next();
    if (claims.role === "product_admin") {
      const acting = request.cookies.get(ACTING_CUSTOMER_COOKIE)?.value;
      if (!acting) return redirectTo(request, "/platform/customers");
      return NextResponse.next();
    }
    return redirectTo(request, "/unauthorized");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/accept-invite", "/unauthorized", "/platform/:path*", "/school/:path*"],
};
