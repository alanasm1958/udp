/**
 * POST /api/auth/signup
 * Create a new tenant with admin user and subscription
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  tenants,
  users,
  actors,
  roles,
  userRoles,
  subscriptionPlans,
  tenantSubscriptions,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "@/lib/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { createSession } from "@/lib/sessions";
import { z } from "zod";

const signupSchema = z.object({
  tenantName: z.string().min(2, "Company name must be at least 2 characters").max(100),
  adminName: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  planCode: z.string().min(1, "Plan is required"),
});

type SignupRequest = z.infer<typeof signupSchema>;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    // Validate input
    const parseResult = signupSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((e) => e.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const { tenantName, adminName, email, password, planCode }: SignupRequest = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Validate plan exists
    const [plan] = await db
      .select({
        code: subscriptionPlans.code,
        billingType: subscriptionPlans.billingType,
        trialDays: subscriptionPlans.trialDays,
        durationMonths: subscriptionPlans.durationMonths,
        intervalCount: subscriptionPlans.intervalCount,
      })
      .from(subscriptionPlans)
      .where(
        and(
          eq(subscriptionPlans.code, planCode),
          eq(subscriptionPlans.isActive, true)
        )
      )
      .limit(1);

    if (!plan) {
      return NextResponse.json(
        { error: "Invalid plan code" },
        { status: 400 }
      );
    }

    // Check if email already exists (globally unique for login)
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Create tenant
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: tenantName.trim(),
        baseCurrency: "USD",
      })
      .returning({ id: tenants.id, name: tenants.name });

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: normalizedEmail,
        fullName: adminName.trim(),
        passwordHash,
        isActive: true,
      })
      .returning({ id: users.id, email: users.email, fullName: users.fullName });

    // Create actor for user
    const [actor] = await db
      .insert(actors)
      .values({
        tenantId: tenant.id,
        type: "user",
        userId: user.id,
      })
      .returning({ id: actors.id });

    // Create admin role for this tenant
    const [adminRole] = await db
      .insert(roles)
      .values({
        tenantId: tenant.id,
        name: "admin",
      })
      .returning({ id: roles.id });

    // Create standard roles for this tenant
    const standardRoles = ["finance", "inventory", "sales", "procurement"];
    for (const roleName of standardRoles) {
      await db.insert(roles).values({
        tenantId: tenant.id,
        name: roleName,
      });
    }

    // Assign admin role to user
    await db.insert(userRoles).values({
      tenantId: tenant.id,
      userId: user.id,
      roleId: adminRole.id,
    });

    // Calculate subscription period
    const now = new Date();
    const periodEnd = new Date(now);

    if (plan.billingType === "trial" && plan.trialDays) {
      periodEnd.setDate(periodEnd.getDate() + plan.trialDays);
    } else if (plan.durationMonths) {
      periodEnd.setMonth(periodEnd.getMonth() + plan.durationMonths);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + (plan.intervalCount || 1));
    }

    const subscriptionStatus = plan.billingType === "trial" ? "trialing" : "active";

    // Create subscription
    await db.insert(tenantSubscriptions).values({
      tenantId: tenant.id,
      planCode: plan.code,
      status: subscriptionStatus,
      isCurrent: true,
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      createdByActorId: actor.id,
      metadata: { source: "signup" },
    });

    // Create session token
    const token = await createSessionToken({
      userId: user.id,
      actorId: actor.id,
      tenantId: tenant.id,
      roles: ["admin"],
      email: user.email,
    });

    // Record session for revocation support
    await createSession({
      tenantId: tenant.id,
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: req.headers.get("user-agent") || undefined,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    });

    // Set session cookie
    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenantId: tenant.id,
        roles: ["admin"],
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
    });
  } catch (error) {
    console.error("POST /api/auth/signup error:", error);
    return NextResponse.json(
      { error: "Signup failed. Please try again." },
      { status: 500 }
    );
  }
}
