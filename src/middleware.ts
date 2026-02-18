/**
 * Next.js Middleware
 * Handles authentication, subscription enforcement, and RBAC page access
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionTokenFromRequest, verifySessionToken } from "@/lib/auth";
import { isSessionValid } from "@/lib/sessions";
import { checkSubscriptionAccess } from "@/lib/entitlements";
import { checkPageAccessByRoute } from "@/lib/rbac-access";
import { checkRateLimit, rateLimitedResponse, getClientIp, AUTH_RATE_LIMIT } from "@/lib/rate-limit";

// Rate-limited auth paths
const RATE_LIMITED_AUTH_PATHS = ["/api/auth/login", "/api/auth/signup"];

// Paths that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/onboarding",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/signup",
  "/api/auth/bootstrap",
  "/api/billing/plans", // Public for signup page plan selection
  "/api/cron/", // Cron endpoints use bearer secret auth
  "/_next",
  "/favicon.ico",
  "/next.svg",
  "/vercel.svg",
];

// Paths that don't require subscription check (but still need auth)
const SUBSCRIPTION_EXEMPT_PATHS = [
  "/billing",
  "/api/billing/",
  "/api/auth/",
  "/api/admin/", // Admin routes use role-based auth, not subscription
  "/tenant-management", // Platform owner routes
  "/api/tenant-management/", // Platform owner API
];

// Paths that are exempt from RBAC page access check
// (always accessible or handled by other mechanisms)
const RBAC_EXEMPT_PATHS = [
  "/dashboard", // Always accessible
  "/settings/tenant", // Always accessible
  "/billing", // Handled by subscription check
  "/api/", // API routes handle their own auth
  "/tenant-management", // Platform owner only (checked separately)
];

// Check if path is public
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

// Check if path is exempt from subscription check
function isSubscriptionExempt(pathname: string): boolean {
  return SUBSCRIPTION_EXEMPT_PATHS.some((path) => pathname.startsWith(path));
}

// Check if path is exempt from RBAC page access check
function isRbacExempt(pathname: string): boolean {
  return RBAC_EXEMPT_PATHS.some((path) => pathname.startsWith(path));
}

// Check if path is an API route
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

// Check if path is admin route (requires admin role)
function isAdminRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/settings")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Rate limit auth endpoints before any other processing
  if (RATE_LIMITED_AUTH_PATHS.some((path) => pathname === path) && method === "POST") {
    const ip = getClientIp(request);
    if (!checkRateLimit(`auth:${ip}`, AUTH_RATE_LIMIT)) {
      return rateLimitedResponse();
    }
  }

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

  // Check token has an active non-revoked server-side session
  const sessionValid = await isSessionValid(token);
  if (!sessionValid) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Check if user has a valid tenantId (edge case for incomplete setup)
  if (!session.tenantId) {
    if (isApiRoute(pathname)) {
      return NextResponse.json(
        { error: "Account not configured. Please contact administrator." },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/onboarding", request.url));
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

  // Check subscription for non-exempt paths
  if (!isSubscriptionExempt(pathname)) {
    // For state-changing API methods, check capabilities
    // For page routes and GET APIs, just check active subscription
    const subCheck = await checkSubscriptionAccess(
      session.tenantId,
      pathname,
      method
    );

    if (!subCheck.ok) {
      // No active subscription
      if (isApiRoute(pathname)) {
        // For capability issues, return 403
        if (subCheck.missingCapability) {
          return NextResponse.json(
            {
              error: subCheck.error,
              capability: subCheck.missingCapability,
              planCode: subCheck.planCode,
            },
            { status: 403 }
          );
        }
        // For subscription issues, return 402 Payment Required
        return NextResponse.json(
          {
            error: subCheck.error,
            hasSubscription: subCheck.hasSubscription,
            isActive: subCheck.isActive,
          },
          { status: 402 }
        );
      }
      // Redirect pages to billing
      return NextResponse.redirect(new URL("/billing", request.url));
    }

    // Inject subscription info into headers for downstream use
    requestHeaders.set("x-subscription-plan", subCheck.planCode || "");
    requestHeaders.set("x-subscription-active", subCheck.isActive.toString());
  }

  // RBAC Page Access Check (only for non-API, non-exempt page routes)
  // Skip for admins as they have full access
  if (!isApiRoute(pathname) && !isRbacExempt(pathname) && !session.roles.includes("admin")) {
    const pageAccess = await checkPageAccessByRoute(
      session.tenantId,
      session.userId,
      pathname
    );

    if (!pageAccess.hasAccess) {
      // User doesn't have access to this page - redirect to dashboard
      return NextResponse.redirect(new URL("/dashboard?access_denied=1", request.url));
    }
  }

  // Continue with the modified headers
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Use Node.js runtime for crypto support
export const runtime = "nodejs";

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
