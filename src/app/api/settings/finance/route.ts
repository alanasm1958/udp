/**
 * /api/settings/finance
 *
 * GET/PUT: Finance settings (cash/bank account codes, liquidity threshold)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenantSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  TenantError,
} from "@/lib/tenant";
import { createAuditContext } from "@/lib/audit";
import { requireRole, ROLES, AuthContext } from "@/lib/authz";

interface FinanceSettings {
  cashAccountCodes: string[];
  bankAccountCodes: string[];
  liquidityMinBalance: number;
  defaultPaymentTermsDays: number;
}

/**
 * GET /api/settings/finance
 * Returns current finance settings for the tenant
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const roleCheck = requireRole(req, [ROLES.ADMIN]);
    if (roleCheck instanceof NextResponse) return roleCheck;
    const auth = roleCheck as AuthContext;
    const tenantId = auth.tenantId;

    const [settings] = await db
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1);

    const response: FinanceSettings = {
      cashAccountCodes: settings?.cashAccountCodes || [],
      bankAccountCodes: settings?.bankAccountCodes || [],
      liquidityMinBalance: settings ? parseFloat(settings.liquidityMinBalance || "50000") : 50000,
      defaultPaymentTermsDays: settings?.defaultPaymentTermsDays || 30,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/settings/finance error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/finance
 * Update finance settings for the tenant
 */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const roleCheck = requireRole(req, [ROLES.ADMIN]);
    if (roleCheck instanceof NextResponse) return roleCheck;
    const auth = roleCheck as AuthContext;
    const tenantId = auth.tenantId;
    const audit = createAuditContext(tenantId, auth.actorId);

    const body: Partial<FinanceSettings> = await req.json();

    // Validate inputs
    if (body.liquidityMinBalance !== undefined && body.liquidityMinBalance < 0) {
      return NextResponse.json(
        { error: "Liquidity minimum balance cannot be negative" },
        { status: 400 }
      );
    }

    if (body.defaultPaymentTermsDays !== undefined && body.defaultPaymentTermsDays < 0) {
      return NextResponse.json(
        { error: "Payment terms days cannot be negative" },
        { status: 400 }
      );
    }

    // Check if settings exist
    const [existing] = await db
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1);

    let settingsId: string;

    if (existing) {
      // Update existing settings
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
        updatedByActorId: auth.actorId,
      };

      if (body.cashAccountCodes !== undefined) {
        updates.cashAccountCodes = body.cashAccountCodes;
      }
      if (body.bankAccountCodes !== undefined) {
        updates.bankAccountCodes = body.bankAccountCodes;
      }
      if (body.liquidityMinBalance !== undefined) {
        updates.liquidityMinBalance = body.liquidityMinBalance.toString();
      }
      if (body.defaultPaymentTermsDays !== undefined) {
        updates.defaultPaymentTermsDays = body.defaultPaymentTermsDays;
      }

      await db
        .update(tenantSettings)
        .set(updates)
        .where(eq(tenantSettings.id, existing.id));

      settingsId = existing.id;
    } else {
      // Create new settings
      const [created] = await db
        .insert(tenantSettings)
        .values({
          tenantId,
          cashAccountCodes: body.cashAccountCodes || [],
          bankAccountCodes: body.bankAccountCodes || [],
          liquidityMinBalance: (body.liquidityMinBalance || 50000).toString(),
          defaultPaymentTermsDays: body.defaultPaymentTermsDays || 30,
          updatedByActorId: auth.actorId,
        })
        .returning();

      settingsId = created.id;
    }

    // Audit the change
    await audit.log("tenant_settings", settingsId, "finance_settings_updated", {
      changes: Object.keys(body),
      cashAccountCodes: body.cashAccountCodes,
      bankAccountCodes: body.bankAccountCodes,
      liquidityMinBalance: body.liquidityMinBalance,
      defaultPaymentTermsDays: body.defaultPaymentTermsDays,
    });

    // Return updated settings
    const [updated] = await db
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1);

    const response: FinanceSettings = {
      cashAccountCodes: updated?.cashAccountCodes || [],
      bankAccountCodes: updated?.bankAccountCodes || [],
      liquidityMinBalance: updated ? parseFloat(updated.liquidityMinBalance || "50000") : 50000,
      defaultPaymentTermsDays: updated?.defaultPaymentTermsDays || 30,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PUT /api/settings/finance error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
