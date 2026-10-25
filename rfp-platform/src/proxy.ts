/**
 * proxy.ts — Next.js 16 route protection layer.
 *
 * NOTE: In Next.js 16 the file is named `proxy.ts` (not `middleware.ts`),
 * and the exported function must be named `proxy`.
 *
 * Protects all application routes except:
 *   - /login            — login page
 *   - /api/auth/*       — auth API routes (login/logout/me)
 *   - /api/health       — health check (for load balancer probes)
 *   - /_next/*          — Next.js internals
 *   - /favicon.ico etc  — static assets
 *
 * On an unauthenticated request:
 *   - Page request  → redirect to /login
 *   - API request   → return 401 JSON
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/health",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths and Next.js internals
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/_vercel/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // Read session cookie
  const token = request.cookies.get("rfp_session")?.value;
  const session = await decrypt(token);

  if (!session) {
    // API request → return 401
    if (pathname.startsWith("/api/")) {
      return Response.json(
        { success: false, message: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    // Page request → redirect to login with return URL
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes
  const ADMIN_PATHS = ["/admin", "/api/admin"];
  if (
    ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) &&
    session.role !== "admin"
  ) {
    if (pathname.startsWith("/api/")) {
      return Response.json(
        { success: false, message: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/upload", request.url));
  }

  // Viewer role — read-only: block mutations
  if (session.role === "viewer") {
    const mutatingMethods = ["POST", "PUT", "PATCH", "DELETE"];
    const viewerAllowedPosts = ["/api/auth/logout", "/api/chat"];
    if (
      mutatingMethods.includes(request.method) &&
      pathname.startsWith("/api/") &&
      !viewerAllowedPosts.some((p) => pathname.startsWith(p))
    ) {
      return Response.json(
        { success: false, message: "Forbidden. Viewers have read-only access." },
        { status: 403 }
      );
    }
  }

  // Inject user identity headers for downstream route handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", session.userId);
  requestHeaders.set("x-user-email", session.email);
  requestHeaders.set("x-user-role", session.role);
  requestHeaders.set("x-user-name", session.name);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets, image optimizations, and metadata files.
     * NOTE: _next/data routes are still covered even when excluded here,
     * per Next.js 16 proxy behaviour documentation.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)",
  ],
};
