/**
 * /api/reports/finance/cashbook
 *
 * GET: Cashbook report - posted payments by method (cash/bank)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { payments, parties } from "@/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

interface CashbookEntry {
  paymentId: string;
  paymentDate: string;
  type: "receipt" | "payment";
  method: "cash" | "bank";
  partyId: string | null;
  partyName: string | null;
  amount: number;
  currency: string;
  reference: string | null;
  memo: string | null;
}

/**
 * GET /api/reports/finance/cashbook
 * Query params: from?, to?, method? (cash|bank), limit?, offset?
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const method = searchParams.get("method") as "cash" | "bank" | null;
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build conditions
    const conditions = [
      eq(payments.tenantId, tenantId),
      eq(payments.status, "posted"),
    ];

    if (from) {
      conditions.push(gte(payments.paymentDate, from));
    }
    if (to) {
      conditions.push(lte(payments.paymentDate, to));
    }
    if (method) {
      conditions.push(eq(payments.method, method));
    }

    // Query payments
    const paymentRows = await db
      .select({
        id: payments.id,
        paymentDate: payments.paymentDate,
        type: payments.type,
        method: payments.method,
        partyId: payments.partyId,
        partyName: parties.name,
        amount: payments.amount,
        currency: payments.currency,
        reference: payments.reference,
        memo: payments.memo,
      })
      .from(payments)
      .leftJoin(parties, eq(payments.partyId, parties.id))
      .where(and(...conditions))
      .orderBy(desc(payments.paymentDate))
      .limit(limit)
      .offset(offset);

    const items: CashbookEntry[] = paymentRows.map((p) => ({
      paymentId: p.id,
      paymentDate: p.paymentDate,
      type: p.type as "receipt" | "payment",
      method: p.method as "cash" | "bank",
      partyId: p.partyId,
      partyName: p.partyName,
      amount: parseFloat(p.amount),
      currency: p.currency,
      reference: p.reference,
      memo: p.memo,
    }));

    // Calculate totals
    let receiptsTotal = 0;
    let paymentsTotal = 0;

    for (const item of items) {
      if (item.type === "receipt") {
        receiptsTotal += item.amount;
      } else {
        paymentsTotal += item.amount;
      }
    }

    return NextResponse.json({
      dateRange: { from, to },
      method,
      items,
      totals: {
        receipts: receiptsTotal,
        payments: paymentsTotal,
        net: receiptsTotal - paymentsTotal,
      },
      pagination: {
        limit,
        offset,
        hasMore: items.length === limit,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/reports/finance/cashbook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
