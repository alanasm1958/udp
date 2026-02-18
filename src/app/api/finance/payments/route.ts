/**
 * /api/finance/payments
 *
 * GET: List payments with filters and pagination
 * POST: Create a new payment (status=draft)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments, parties } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";
import { validateBody, createPaymentSchema } from "@/lib/api-validation";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { logger } from "@/lib/logger";
import { requireRole, ROLES } from "@/lib/authz";

/**
 * GET /api/finance/payments
 * List payments with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const roleCheck = requireRole(req, [ROLES.FINANCE]);
    if (roleCheck instanceof NextResponse) return roleCheck;

    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);
    const { limit, offset } = parsePagination(searchParams);

    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const partyId = searchParams.get("partyId");

    const conditions = [eq(payments.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(payments.status, status as "draft" | "posted" | "void"));
    }
    if (type) {
      conditions.push(eq(payments.type, type as "receipt" | "payment"));
    }
    if (partyId) {
      conditions.push(eq(payments.partyId, partyId));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db
        .select({
          id: payments.id,
          type: payments.type,
          method: payments.method,
          paymentDate: payments.paymentDate,
          partyId: payments.partyId,
          partyName: parties.name,
          currency: payments.currency,
          amount: payments.amount,
          memo: payments.memo,
          reference: payments.reference,
          status: payments.status,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .leftJoin(parties, eq(payments.partyId, parties.id))
        .where(whereClause)
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(payments)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    return NextResponse.json(paginatedResponse(items, total, { limit, offset }));
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error("GET /api/finance/payments failed", error, { route: "/api/finance/payments" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/finance/payments
 * Create a new payment (status=draft)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const roleCheck = requireRole(req, [ROLES.FINANCE]);
    if (roleCheck instanceof NextResponse) return roleCheck;

    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const rawBody = await req.json();
    const validation = validateBody(createPaymentSchema, rawBody);
    if (!validation.success) {
      return validation.response;
    }
    const body = validation.data;

    const amount = parseFloat(body.amount);

    // Validate party exists if provided
    if (body.partyId) {
      const [party] = await db
        .select({ id: parties.id })
        .from(parties)
        .where(and(eq(parties.tenantId, tenantId), eq(parties.id, body.partyId)))
        .limit(1);

      if (!party) {
        return NextResponse.json({ error: "Party not found" }, { status: 404 });
      }
    }

    // Create payment and audit within a transaction
    const payment = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(payments)
        .values({
          tenantId,
          type: body.type,
          method: body.method,
          paymentDate: body.paymentDate,
          partyId: body.partyId ?? null,
          currency: body.currency || "USD",
          amount: amount.toFixed(6),
          memo: body.memo ?? null,
          reference: body.reference ?? null,
          status: "draft",
          createdByActorId: actor.actorId,
        })
        .returning();

      return created;
    });

    await audit.log("payment", payment.id, "payment_created", {
      type: body.type,
      method: body.method,
      amount,
      partyId: body.partyId,
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error("POST /api/finance/payments failed", error, { route: "/api/finance/payments" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
