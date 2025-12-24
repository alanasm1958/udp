/**
 * /api/strategy/budgets
 *
 * CRUD endpoints for budget master data.
 * GET: List budgets with optional filters (q, type, limit)
 * POST: Create a new budget with auto-generated baseline version
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { budgets, budgetVersions } from "@/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateBudgetRequest {
  code: string;
  name: string;
  budgetType: string;
  currency?: string;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}

/**
 * GET /api/strategy/budgets
 * List budgets for the tenant with optional filters
 * Query params: type (budget_type), q (search name/code), limit (default 50, max 200)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const typeFilter = url.searchParams.get("type");
    const searchQuery = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(budgets.tenantId, tenantId)];

    if (typeFilter) {
      conditions.push(eq(budgets.budgetType, typeFilter));
    }

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      conditions.push(
        or(ilike(budgets.name, searchPattern), ilike(budgets.code, searchPattern))!
      );
    }

    const budgetList = await db
      .select({
        id: budgets.id,
        code: budgets.code,
        name: budgets.name,
        budgetType: budgets.budgetType,
        currency: budgets.currency,
        periodStart: budgets.periodStart,
        periodEnd: budgets.periodEnd,
        status: budgets.status,
        createdAt: budgets.createdAt,
      })
      .from(budgets)
      .where(and(...conditions))
      .limit(limit);

    return NextResponse.json({ items: budgetList });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/strategy/budgets error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/strategy/budgets
 * Create a new budget and auto-create baseline version (version_no=1)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateBudgetRequest = await req.json();

    if (!body.code || !body.name || !body.budgetType || !body.periodStart || !body.periodEnd) {
      return NextResponse.json(
        { error: "code, name, budgetType, periodStart, and periodEnd are required" },
        { status: 400 }
      );
    }

    const [budget] = await db
      .insert(budgets)
      .values({
        tenantId,
        code: body.code,
        name: body.name,
        budgetType: body.budgetType,
        currency: body.currency ?? "USD",
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        notes: body.notes ?? null,
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("budget", budget.id, "budget_created", {
      code: body.code,
      name: body.name,
      budgetType: body.budgetType,
    });

    const [version] = await db
      .insert(budgetVersions)
      .values({
        tenantId,
        budgetId: budget.id,
        versionNo: 1,
        label: "baseline",
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("budget_version", version.id, "budget_version_created", {
      budgetId: budget.id,
      versionNo: 1,
      label: "baseline",
    });

    return NextResponse.json(
      {
        id: budget.id,
        code: budget.code,
        name: budget.name,
        budgetType: budget.budgetType,
        currency: budget.currency,
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd,
        status: budget.status,
        notes: budget.notes,
        createdAt: budget.createdAt,
        activeVersion: {
          id: version.id,
          versionNo: version.versionNo,
          label: version.label,
          status: version.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/strategy/budgets error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
