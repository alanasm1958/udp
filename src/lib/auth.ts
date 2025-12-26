/**
 * Authentication helpers
 * JWT session management with HttpOnly cookies
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-change-in-production";
const COOKIE_NAME = "udp_session";
const TOKEN_EXPIRY = "7d";

// Encode secret for jose
function getSecretKey() {
  return new TextEncoder().encode(AUTH_SECRET);
}

export interface SessionPayload extends JWTPayload {
  userId: string;
  actorId: string;
  tenantId: string;
  roles: string[];
  email: string;
}

/**
 * Create a signed JWT session token
 */
export async function createSessionToken(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  const token = await new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getSecretKey());

  return token;
}

/**
 * Verify and decode a session token
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Set the session cookie (for use in API routes)
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/**
 * Clear the session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Get session from cookie (for use in API routes / server components)
 */
export async function getSessionFromCookie(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

/**
 * Get session token from request headers (for middleware)
 */
export function getSessionTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith(`${COOKIE_NAME}=`));

  if (!sessionCookie) return null;

  return sessionCookie.split("=")[1];
}

export { COOKIE_NAME };
