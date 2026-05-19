import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE = "fp_auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow login route, API auth route, static assets, and Next internals.
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const expected = process.env.AUTH_COOKIE_SECRET;

  if (!expected || cookie !== expected) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
