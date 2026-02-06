/**
 * Individual Tenant Management API
 * Platform owner only - view, update, suspend, archive tenants
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  tenants,
  users,
  tenantSubscriptions,
  tenantPaymentHistory,
  auditEvents,
} from "@/db/schema";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { requirePlatformOwner } from "@/lib/authz";
import { logAuditEvent, AuditAction } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tenant-management/[id]
 * Get detailed tenant information
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const authResult = await requirePlatformOwner(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  try {
    // Get tenant with stats
    const [tenant] = await db
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
      })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Get user stats
    const [userStats] = await db
      .select({
        total: count(),
        active: sql<number>`COUNT(*) FILTER (WHERE is_active = true)`,
      })
      .from(users)
      .where(eq(users.tenantId, id));

    // Get current subscription
    const [subscription] = await db
      .select()
      .from(tenantSubscriptions)
      .where(
        and(
          eq(tenantSubscriptions.tenantId, id),
          eq(tenantSubscriptions.isCurrent, true)
        )
      )
      .limit(1);

    // Get recent payments
    const recentPayments = await db
      .select()
      .from(tenantPaymentHistory)
      .where(eq(tenantPaymentHistory.tenantId, id))
      .orderBy(desc(tenantPaymentHistory.createdAt))
      .limit(10);

    // Get recent audit events for this tenant
    const recentActivity = await db
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        entityType: auditEvents.entityType,
        occurredAt: auditEvents.occurredAt,
      })
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, id))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(20);

    return NextResponse.json({
      tenant,
      stats: {
        users: {
          total: userStats?.total || 0,
          active: userStats?.active || 0,
        },
      },
      subscription: subscription || null,
      recentPayments,
      recentActivity,
    });
  } catch (error) {
    console.error("Error fetching tenant:", error);
    return NextResponse.json(
      { error: "Failed to fetch tenant" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tenant-management/[id]
 * Update tenant details, status, subscription
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const authResult = await requirePlatformOwner(req);
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const { id } = await params;

  try {
    const body = await req.json();
    const { name, status, suspendedReason, planCode } = body;

    // Get current tenant
    const [currentTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    if (!currentTenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Prevent modifying platform owner's core status
    if (currentTenant.isPlatformOwner && status === "archived") {
      return NextResponse.json(
        { error: "Cannot archive platform owner tenant" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    const auditChanges: Record<string, { from: unknown; to: unknown }> = {};

    // Handle name update
    if (name && name !== currentTenant.name) {
      updates.name = name;
      auditChanges.name = { from: currentTenant.name, to: name };
    }

    // Handle status changes
    if (status && status !== currentTenant.status) {
      if (!["active", "suspended", "archived"].includes(status)) {
        return NextResponse.json(
          { error: "Invalid status. Must be: active, suspended, archived" },
          { status: 400 }
        );
      }

      updates.status = status;
      auditChanges.status = { from: currentTenant.status, to: status };

      if (status === "suspended") {
        updates.suspendedAt = new Date();
        updates.suspendedReason = suspendedReason || null;
      } else if (status === "active") {
        updates.suspendedAt = null;
        updates.suspendedReason = null;
      } else if (status === "archived") {
        updates.archivedAt = new Date();
      }
    }

    // Update tenant
    if (Object.keys(updates).length > 0) {
      await db.update(tenants).set(updates).where(eq(tenants.id, id));
    }

    // Handle subscription plan change
    if (planCode) {
      const [currentSub] = await db
        .select()
        .from(tenantSubscriptions)
        .where(
          and(
            eq(tenantSubscriptions.tenantId, id),
            eq(tenantSubscriptions.isCurrent, true)
          )
        )
        .limit(1);

      if (currentSub && currentSub.planCode !== planCode) {
        // Update subscription
        await db
          .update(tenantSubscriptions)
          .set({ planCode })
          .where(eq(tenantSubscriptions.id, currentSub.id));

        auditChanges.planCode = { from: currentSub.planCode, to: planCode };
      }
    }

    // Audit log
    if (Object.keys(auditChanges).length > 0) {
      await logAuditEvent({
        tenantId: auth.tenantId,
        actorId: auth.actorId,
        action: "tenant_updated" as AuditAction,
        entityType: "tenant",
        entityId: id,
        metadata: {
          changes: auditChanges,
          byPlatformOwner: true,
        },
      });
    }

    // Fetch updated tenant
    const [updatedTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    return NextResponse.json({
      success: true,
      tenant: updatedTenant,
    });
  } catch (error) {
    console.error("Error updating tenant:", error);
    return NextResponse.json(
      { error: "Failed to update tenant" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tenant-management/[id]
 * Soft delete (archive) a tenant
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const authResult = await requirePlatformOwner(req);
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const { id } = await params;

  try {
    // Get tenant
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Prevent deleting platform owner
    if (tenant.isPlatformOwner) {
      return NextResponse.json(
        { error: "Cannot delete platform owner tenant" },
        { status: 400 }
      );
    }

    // Soft delete - archive the tenant
    await db
      .update(tenants)
      .set({
        status: "archived",
        archivedAt: new Date(),
      })
      .where(eq(tenants.id, id));

    // Deactivate all users in the tenant
    await db
      .update(users)
      .set({ isActive: false })
      .where(eq(users.tenantId, id));

    // Audit log
    await logAuditEvent({
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      action: "tenant_deleted" as AuditAction,
      entityType: "tenant",
      entityId: id,
      metadata: {
        tenantName: tenant.name,
        byPlatformOwner: true,
        softDelete: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Tenant archived successfully",
    });
  } catch (error) {
    console.error("Error deleting tenant:", error);
    return NextResponse.json(
      { error: "Failed to delete tenant" },
      { status: 500 }
    );
  }
}
