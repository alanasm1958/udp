/**
 * /api/onboarding/coa
 *
 * POST: Create Chart of Accounts from template
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { db } from "@/db";
import { accounts, chartOfAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createAuditContext } from "@/lib/audit";
import { getCoATemplate } from "@/lib/coa-templates";

/**
 * POST /api/onboarding/coa
 * Body:
 *   - templateId: string (required)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);
    const body = await req.json();

    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    // Get template
    const template = getCoATemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Check if accounts already exist
    const existingAccounts = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.tenantId, tenantId))
      .limit(1);

    if (existingAccounts.length > 0) {
      return NextResponse.json(
        { error: "Accounts already exist. Cannot apply template to existing chart." },
        { status: 409 }
      );
    }

    // Get or create Chart of Accounts for this tenant
    let [coa] = await db
      .select({ id: chartOfAccounts.id })
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.tenantId, tenantId))
      .limit(1);

    if (!coa) {
      [coa] = await db
        .insert(chartOfAccounts)
        .values({
          tenantId,
          name: template.name,
        })
        .returning({ id: chartOfAccounts.id });
    }

    // Create accounts from template
    const createdAccounts = await db
      .insert(accounts)
      .values(
        template.accounts.map((acct) => ({
          tenantId,
          coaId: coa.id,
          code: acct.code,
          name: acct.name,
          type: acct.type,
        }))
      )
      .returning({ id: accounts.id, code: accounts.code });

    await audit.log(
      "accounts",
      tenantId,
      "onboarding_coa_created",
      {
        templateId,
        templateName: template.name,
        accountCount: createdAccounts.length,
      }
    );

    return NextResponse.json({
      success: true,
      templateId,
      templateName: template.name,
      accountsCreated: createdAccounts.length,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/onboarding/coa error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
