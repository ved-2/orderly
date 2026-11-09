import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protected route prefixes that require user authentication
  const protectedPrefixes = [
    "/retailer",
    "/distributor",
    "/order-desk",
    "/salesman",
  ];

  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isProtected) {
    const isLoggedIn = request.cookies.get("orderly_logged_in")?.value;

    // If no authentication cookie is present, redirect to the login/registration page
    if (!isLoggedIn) {
      const loginUrl = new URL("/register", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/retailer/:path*",
    "/distributor/:path*",
    "/order-desk/:path*",
    "/salesman/:path*",
  ],
};
