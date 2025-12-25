/**
 * /api/finance/payments
 *
 * GET: List payments with filters and pagination
 * POST: Create a new payment (status=draft)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments, parties } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

type PaymentType = "receipt" | "payment";
type PaymentMethod = "cash" | "bank";

interface CreatePaymentRequest {
  type: PaymentType;
  method: PaymentMethod;
  paymentDate: string;
  partyId?: string;
  currency?: string;
  amount: string;
  memo?: string;
  reference?: string;
}

/**
 * GET /api/finance/payments
 * List payments with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const partyId = searchParams.get("partyId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const conditions = [eq(payments.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(payments.status, status as "draft" | "posted" | "void"));
    }
    if (type) {
      conditions.push(eq(payments.type, type as PaymentType));
    }
    if (partyId) {
      conditions.push(eq(payments.partyId, partyId));
    }

    const items = await db
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
      .where(and(...conditions))
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/finance/payments error:", error);
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
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreatePaymentRequest = await req.json();

    // Validate required fields
    if (!body.type || !body.method || !body.paymentDate || !body.amount) {
      return NextResponse.json(
        { error: "type, method, paymentDate, and amount are required" },
        { status: 400 }
      );
    }

    const validTypes: PaymentType[] = ["receipt", "payment"];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: "type must be one of: receipt, payment" },
        { status: 400 }
      );
    }

    const validMethods: PaymentMethod[] = ["cash", "bank"];
    if (!validMethods.includes(body.method)) {
      return NextResponse.json(
        { error: "method must be one of: cash, bank" },
        { status: 400 }
      );
    }

    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number" },
        { status: 400 }
      );
    }

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

    // Create payment
    const [payment] = await db
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
    console.error("POST /api/finance/payments error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
