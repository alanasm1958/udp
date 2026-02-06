/**
 * Tenant Management API
 * Platform owner only - manage all tenants on the platform
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  tenants,
  users,
  roles,
  userRoles,
  actors,
  tenantSubscriptions,
  tenantPaymentHistory,
} from "@/db/schema";
import { eq, desc, ilike, or, sql, and, count } from "drizzle-orm";
import { requirePlatformOwner } from "@/lib/authz";
import { hashPassword } from "@/lib/password";
import { logAuditEvent, AuditAction } from "@/lib/audit";

/**
 * GET /api/tenant-management
 * List all tenants with stats
 */
export async function GET(req: NextRequest) {
  const authResult = await requirePlatformOwner(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Build where conditions
    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(tenants.name, `%${search}%`),
          ilike(tenants.id, `%${search}%`)
        )
      );
    }
    if (status && ["active", "suspended", "archived"].includes(status)) {
      conditions.push(eq(tenants.status, status));
    }

    // Get tenants with user counts
    const tenantsWithStats = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        baseCurrency: tenants.baseCurrency,
        isPlatformOwner: tenants.isPlatformOwner,
        status: tenants.status,
        suspendedAt: tenants.suspendedAt,
        suspendedReason: tenants.suspendedReason,
        archivedAt: tenants.archivedAt,
        lastActivityAt: tenants.lastActivityAt,
        createdAt: tenants.createdAt,
        userCount: sql<number>`(SELECT COUNT(*) FROM users WHERE tenant_id = ${tenants.id})`.as("user_count"),
        activeUserCount: sql<number>`(SELECT COUNT(*) FROM users WHERE tenant_id = ${tenants.id} AND is_active = true)`.as("active_user_count"),
      })
      .from(tenants)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tenants.createdAt))
      .limit(limit)
      .offset(offset);

    // Get subscription info for each tenant
    const tenantIds = tenantsWithStats.map((t) => t.id);
    const subscriptions = tenantIds.length > 0
      ? await db
          .select({
            tenantId: tenantSubscriptions.tenantId,
            planCode: tenantSubscriptions.planCode,
            status: tenantSubscriptions.status,
            currentPeriodEnd: tenantSubscriptions.currentPeriodEnd,
          })
          .from(tenantSubscriptions)
          .where(
            and(
              sql`${tenantSubscriptions.tenantId} IN ${tenantIds}`,
              eq(tenantSubscriptions.isCurrent, true)
            )
          )
      : [];

    // Map subscriptions to tenants
    const subscriptionMap = new Map(subscriptions.map((s) => [s.tenantId, s]));

    const enrichedTenants = tenantsWithStats.map((t) => ({
      ...t,
      subscription: subscriptionMap.get(t.id) || null,
    }));

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(tenants)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return NextResponse.json({
      tenants: enrichedTenants,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + enrichedTenants.length < total,
      },
    });
  } catch (error) {
    console.error("Error listing tenants:", error);
    return NextResponse.json(
      { error: "Failed to list tenants" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tenant-management
 * Create a new tenant with initial admin user
 */
export async function POST(req: NextRequest) {
  const authResult = await requirePlatformOwner(req);
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  try {
    const body = await req.json();
    const {
      tenantName,
      baseCurrency = "USD",
      adminEmail,
      adminFullName,
      adminPassword,
      planCode = "free",
    } = body;

    // Validate required fields
    if (!tenantName || !adminEmail || !adminFullName || !adminPassword) {
      return NextResponse.json(
        { error: "Missing required fields: tenantName, adminEmail, adminFullName, adminPassword" },
        { status: 400 }
      );
    }

    // Check if email already exists globally
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, adminEmail.toLowerCase()))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      );
    }

    // Create tenant, user, roles in a transaction
    const result = await db.transaction(async (tx) => {
      // 1. Create tenant
      const [newTenant] = await tx
        .insert(tenants)
        .values({
          name: tenantName,
          baseCurrency,
          status: "active",
        })
        .returning();

      // 2. Create admin user
      const passwordHash = await hashPassword(adminPassword);
      const [newUser] = await tx
        .insert(users)
        .values({
          tenantId: newTenant.id,
          email: adminEmail.toLowerCase(),
          fullName: adminFullName,
          passwordHash,
          isActive: true,
        })
        .returning();

      // 3. Create actor for the user
      const [newActor] = await tx
        .insert(actors)
        .values({
          tenantId: newTenant.id,
          type: "user",
          userId: newUser.id,
        })
        .returning();

      // 4. Create standard roles
      const roleNames = ["admin", "finance", "inventory", "sales", "procurement"];
      const createdRoles = await tx
        .insert(roles)
        .values(roleNames.map((name) => ({ tenantId: newTenant.id, name })))
        .returning();

      // 5. Assign admin role to user
      const adminRole = createdRoles.find((r) => r.name === "admin");
      if (adminRole) {
        await tx.insert(userRoles).values({
          tenantId: newTenant.id,
          userId: newUser.id,
          roleId: adminRole.id,
        });
      }

      // 6. Create subscription
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await tx.insert(tenantSubscriptions).values({
        tenantId: newTenant.id,
        planCode,
        status: "active",
        isCurrent: true,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        createdByActorId: newActor.id,
      });

      return {
        tenant: newTenant,
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
        },
        roles: createdRoles,
      };
    });

    // Audit log
    await logAuditEvent({
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      action: "tenant_created" as AuditAction,
      entityType: "tenant",
      entityId: result.tenant.id,
      metadata: {
        tenantName,
        adminEmail,
        planCode,
        createdByPlatformOwner: true,
      },
    });

    return NextResponse.json({
      success: true,
      tenant: result.tenant,
      user: result.user,
    });
  } catch (error) {
    console.error("Error creating tenant:", error);
    return NextResponse.json(
      { error: "Failed to create tenant" },
      { status: 500 }
    );
  }
}
