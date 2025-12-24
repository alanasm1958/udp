/**
 * /api/strategy/budgets/[id]/lines
 *
 * POST: Add a budget line to the active version (latest version_no)
 * GET: List lines for the active version
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { budgetVersions, budgetLines } from "@/db/schema";
import { eq, and, ilike, or, desc, max } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateBudgetLineRequest {
  name: string;
  description?: string;
  amount: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
  accountId?: string;
  partyId?: string;
  productId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * GET /api/strategy/budgets/[id]/lines
 * List lines for the active version (latest version_no)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id: budgetId } = await params;
    const url = new URL(req.url);

    const searchQuery = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    // Find the latest version for this budget
    const [activeVersion] = await db
      .select({ id: budgetVersions.id })
      .from(budgetVersions)
      .where(
        and(
          eq(budgetVersions.tenantId, tenantId),
          eq(budgetVersions.budgetId, budgetId),
          eq(budgetVersions.status, "active")
        )
      )
      .orderBy(desc(budgetVersions.versionNo))
      .limit(1);

    if (!activeVersion) {
      return NextResponse.json({ error: "No active version found for this budget" }, { status: 404 });
    }

    const conditions = [
      eq(budgetLines.tenantId, tenantId),
      eq(budgetLines.budgetVersionId, activeVersion.id),
    ];

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      conditions.push(
        or(ilike(budgetLines.name, searchPattern), ilike(budgetLines.description, searchPattern))!
      );
    }

    const lines = await db
      .select({
        id: budgetLines.id,
        lineNo: budgetLines.lineNo,
        name: budgetLines.name,
        description: budgetLines.description,
        amount: budgetLines.amount,
        currency: budgetLines.currency,
        startDate: budgetLines.startDate,
        endDate: budgetLines.endDate,
        accountId: budgetLines.accountId,
        partyId: budgetLines.partyId,
        productId: budgetLines.productId,
        metadata: budgetLines.metadata,
        createdAt: budgetLines.createdAt,
      })
      .from(budgetLines)
      .where(and(...conditions))
      .limit(limit);

    return NextResponse.json({ items: lines, versionId: activeVersion.id });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/strategy/budgets/[id]/lines error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/strategy/budgets/[id]/lines
 * Add a budget line to the active version
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const { id: budgetId } = await params;
    const body: CreateBudgetLineRequest = await req.json();

    if (!body.name || body.amount === undefined) {
      return NextResponse.json({ error: "name and amount are required" }, { status: 400 });
    }

    // Find the latest active version for this budget
    const [activeVersion] = await db
      .select({ id: budgetVersions.id })
      .from(budgetVersions)
      .where(
        and(
          eq(budgetVersions.tenantId, tenantId),
          eq(budgetVersions.budgetId, budgetId),
          eq(budgetVersions.status, "active")
        )
      )
      .orderBy(desc(budgetVersions.versionNo))
      .limit(1);

    if (!activeVersion) {
      return NextResponse.json({ error: "No active version found for this budget" }, { status: 404 });
    }

    // Get the next line_no
    const [maxLineResult] = await db
      .select({ maxLine: max(budgetLines.lineNo) })
      .from(budgetLines)
      .where(
        and(
          eq(budgetLines.tenantId, tenantId),
          eq(budgetLines.budgetVersionId, activeVersion.id)
        )
      );

    const nextLineNo = (maxLineResult?.maxLine ?? 0) + 1;

    const [line] = await db
      .insert(budgetLines)
      .values({
        tenantId,
        budgetVersionId: activeVersion.id,
        lineNo: nextLineNo,
        name: body.name,
        description: body.description ?? null,
        amount: body.amount,
        currency: body.currency ?? "USD",
        startDate: body.startDate ?? null,
        endDate: body.endDate ?? null,
        accountId: body.accountId ?? null,
        partyId: body.partyId ?? null,
        productId: body.productId ?? null,
        metadata: body.metadata ?? null,
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("budget_line", line.id, "budget_line_created", {
      budgetId,
      versionId: activeVersion.id,
      lineNo: nextLineNo,
      name: body.name,
      amount: body.amount,
    });

    return NextResponse.json(line, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/strategy/budgets/[id]/lines error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
