import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/config";

const protectedPrefixes = [
  "/superadmin",
  "/dashboard",
  "/customers",
  "/motorcycles",
  "/contracts",
  "/payments",
  "/installments",
  "/maintenance",
  "/documents",
  "/notifications",
  "/reports",
  "/settings",
  "/team",
  "/audit",
  "/customer"
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/superadmin/:path*",
    "/dashboard/:path*",
    "/customers/:path*",
    "/motorcycles/:path*",
    "/contracts/:path*",
    "/payments/:path*",
    "/installments/:path*",
    "/maintenance/:path*",
    "/documents/:path*",
    "/notifications/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/team/:path*",
    "/audit/:path*",
    "/customer/:path*"
  ]
};
