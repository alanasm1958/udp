/**
 * Next.js Middleware
 * Handles authentication and injects tenant context into request headers
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionTokenFromRequest, verifySessionToken } from "@/lib/auth";

// Paths that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/bootstrap",
  "/_next",
  "/favicon.ico",
  "/next.svg",
  "/vercel.svg",
];

// Check if path is public
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

// Check if path is an API route
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

// Check if path is admin route (requires admin role)
function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Get session token from cookie
  const token = getSessionTokenFromRequest(request);

  if (!token) {
    // No token - redirect to login for pages, return 401 for API
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verify token
  const session = await verifySessionToken(token);

  if (!session) {
    // Invalid token - redirect to login for pages, return 401 for API
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Check admin routes require admin role
  if (isAdminRoute(pathname)) {
    const hasAdmin = session.roles.includes("admin");
    if (!hasAdmin) {
      if (isApiRoute(pathname)) {
        return NextResponse.json(
          { error: "Forbidden: admin access required" },
          { status: 403 }
        );
      }
      // Redirect non-admin users to dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Clone the request headers and inject tenant context
  const requestHeaders = new Headers(request.headers);

  // IMPORTANT: Overwrite any incoming values for security
  requestHeaders.set("x-tenant-id", session.tenantId);
  requestHeaders.set("x-user-id", session.userId);
  requestHeaders.set("x-actor-id", session.actorId);
  requestHeaders.set("x-user-roles", session.roles.join(","));
  requestHeaders.set("x-user-email", session.email);

  // Continue with the modified headers
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
