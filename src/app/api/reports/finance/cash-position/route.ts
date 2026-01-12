/**
 * /api/reports/finance/cash-position
 *
 * GET: Cash Position Report - balances, movements, and 4-week forecast
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  accounts,
  journalLines,
  journalEntries,
  payments,
  tenantSettings,
  salesDocs,
  purchaseDocs,
  paymentAllocations,
} from "@/db/schema";
import { eq, and, sql, gte, lte, desc, or, inArray } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

interface CashAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  balance: number;
  method: "cash" | "bank";
}

interface CashMovement {
  date: string;
  type: "receipt" | "payment";
  reference: string;
  description: string;
  amount: number;
  runningBalance: number;
}

interface CashForecast {
  period: string;
  weekStart: string;
  weekEnd: string;
  openingBalance: number;
  expectedReceipts: number;
  expectedPayments: number;
  closingBalance: number;
  receiptsFromAR: number;
  receiptsFromHistory: number;
  paymentsFromAP: number;
  paymentsFromHistory: number;
}

interface CashPositionResult {
  asOf: string;
  totalCash: number;
  totalBank: number;
  totalBalance: number;
  cashAccountCount: number;
  bankAccountCount: number;
  trend30Days: number;
  liquidityMinBalance: number;
  accounts: CashAccount[];
  movements: CashMovement[];
  forecast: CashForecast[];
}

// Default account codes for cash/bank if not configured
const DEFAULT_CASH_CODES = ["1000"];
const DEFAULT_BANK_CODES = ["1010", "1020"];

/**
 * GET /api/reports/finance/cash-position
 * Query params: from?, to? (for movements)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);

    const today = new Date();
    const asOf = today.toISOString().split("T")[0];

    // Get tenant settings
    const [settings] = await db
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1);

    const cashCodes = settings?.cashAccountCodes?.length ? settings.cashAccountCodes : DEFAULT_CASH_CODES;
    const bankCodes = settings?.bankAccountCodes?.length ? settings.bankAccountCodes : DEFAULT_BANK_CODES;
    const liquidityMinBalance = settings ? parseFloat(settings.liquidityMinBalance || "50000") : 50000;
    const allCodes = [...cashCodes, ...bankCodes];

    // Get cash/bank accounts with balances
    const accountsWithBalances = await db
      .select({
        id: accounts.id,
        code: accounts.code,
        name: accounts.name,
        balance: sql<string>`COALESCE(SUM(${journalLines.debit}) - SUM(${journalLines.credit}), 0)`,
      })
      .from(accounts)
      .leftJoin(
        journalLines,
        and(
          eq(journalLines.accountId, accounts.id),
          eq(journalLines.tenantId, tenantId)
        )
      )
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.isActive, true),
          inArray(accounts.code, allCodes)
        )
      )
      .groupBy(accounts.id, accounts.code, accounts.name);

    // Map accounts with method
    const cashAccounts: CashAccount[] = accountsWithBalances.map((acc) => ({
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      balance: parseFloat(acc.balance),
      method: cashCodes.includes(acc.code) ? "cash" as const : "bank" as const,
    }));

    const totalCash = cashAccounts
      .filter((a) => a.method === "cash")
      .reduce((sum, a) => sum + a.balance, 0);

    const totalBank = cashAccounts
      .filter((a) => a.method === "bank")
      .reduce((sum, a) => sum + a.balance, 0);

    const totalBalance = totalCash + totalBank;

    // Get movements from posted payments (last 30 days)
    const from = searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const to = searchParams.get("to") || asOf;

    const paymentMovements = await db
      .select({
        id: payments.id,
        paymentDate: payments.paymentDate,
        type: payments.type,
        reference: payments.reference,
        memo: payments.memo,
        amount: payments.amount,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.status, "posted"),
          gte(payments.paymentDate, from),
          lte(payments.paymentDate, to)
        )
      )
      .orderBy(desc(payments.paymentDate))
      .limit(50);

    // Calculate running balances for movements
    let runningBalance = totalBalance;
    const movements: CashMovement[] = paymentMovements.map((p) => {
      const amount = p.type === "receipt" ? parseFloat(p.amount) : -parseFloat(p.amount);
      const movement: CashMovement = {
        date: p.paymentDate,
        type: p.type,
        reference: p.reference || p.id.substring(0, 8),
        description: p.memo || `${p.type === "receipt" ? "Receipt" : "Payment"}`,
        amount,
        runningBalance,
      };
      runningBalance -= amount; // Go backwards in time
      return movement;
    });

    // Calculate 30-day trend
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [recentMovements] = await db
      .select({
        netReceipts: sql<string>`COALESCE(SUM(CASE WHEN ${payments.type} = 'receipt' THEN ${payments.amount} ELSE 0 END), 0)`,
        netPayments: sql<string>`COALESCE(SUM(CASE WHEN ${payments.type} = 'payment' THEN ${payments.amount} ELSE 0 END), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.status, "posted"),
          gte(payments.paymentDate, thirtyDaysAgo.toISOString().split("T")[0])
        )
      );

    const [previousMovements] = await db
      .select({
        netReceipts: sql<string>`COALESCE(SUM(CASE WHEN ${payments.type} = 'receipt' THEN ${payments.amount} ELSE 0 END), 0)`,
        netPayments: sql<string>`COALESCE(SUM(CASE WHEN ${payments.type} = 'payment' THEN ${payments.amount} ELSE 0 END), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.status, "posted"),
          gte(payments.paymentDate, sixtyDaysAgo.toISOString().split("T")[0]),
          lte(payments.paymentDate, thirtyDaysAgo.toISOString().split("T")[0])
        )
      );

    const recentNet = parseFloat(recentMovements?.netReceipts || "0") - parseFloat(recentMovements?.netPayments || "0");
    const previousNet = parseFloat(previousMovements?.netReceipts || "0") - parseFloat(previousMovements?.netPayments || "0");
    const trend30Days = recentNet - previousNet;

    // Calculate 4-week forecast
    const forecast = await computeForecast(tenantId, totalBalance, liquidityMinBalance);

    const result: CashPositionResult = {
      asOf,
      totalCash,
      totalBank,
      totalBalance,
      cashAccountCount: cashAccounts.filter((a) => a.method === "cash").length,
      bankAccountCount: cashAccounts.filter((a) => a.method === "bank").length,
      trend30Days,
      liquidityMinBalance,
      accounts: cashAccounts,
      movements,
      forecast,
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/reports/finance/cash-position error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Compute 4-week forecast based on open AR/AP due dates and trailing averages
 */
async function computeForecast(
  tenantId: string,
  currentBalance: number,
  liquidityMinBalance: number
): Promise<CashForecast[]> {
  const today = new Date();
  const forecast: CashForecast[] = [];

  // Get open AR (receivables due in next 4 weeks)
  const openAR = await db
    .select({
      dueDate: salesDocs.dueDate,
      docDate: salesDocs.docDate,
      totalAmount: salesDocs.totalAmount,
      docId: salesDocs.id,
    })
    .from(salesDocs)
    .where(
      and(
        eq(salesDocs.tenantId, tenantId),
        eq(salesDocs.status, "posted"),
        eq(salesDocs.docType, "invoice")
      )
    );

  // Get allocations for AR docs
  const arAllocations = await db
    .select({
      targetId: paymentAllocations.targetId,
      allocated: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)`,
    })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .where(
      and(
        eq(paymentAllocations.tenantId, tenantId),
        eq(paymentAllocations.targetType, "sales_doc"),
        eq(payments.status, "posted")
      )
    )
    .groupBy(paymentAllocations.targetId);

  const arAllocMap = new Map<string, number>();
  for (const a of arAllocations) {
    arAllocMap.set(a.targetId, parseFloat(a.allocated));
  }

  // Get open AP (payables due in next 4 weeks)
  const openAP = await db
    .select({
      dueDate: purchaseDocs.dueDate,
      docDate: purchaseDocs.docDate,
      totalAmount: purchaseDocs.totalAmount,
      docId: purchaseDocs.id,
    })
    .from(purchaseDocs)
    .where(
      and(
        eq(purchaseDocs.tenantId, tenantId),
        eq(purchaseDocs.status, "posted"),
        eq(purchaseDocs.docType, "invoice")
      )
    );

  // Get allocations for AP docs
  const apAllocations = await db
    .select({
      targetId: paymentAllocations.targetId,
      allocated: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)`,
    })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .where(
      and(
        eq(paymentAllocations.tenantId, tenantId),
        eq(paymentAllocations.targetType, "purchase_doc"),
        eq(payments.status, "posted")
      )
    )
    .groupBy(paymentAllocations.targetId);

  const apAllocMap = new Map<string, number>();
  for (const a of apAllocations) {
    apAllocMap.set(a.targetId, parseFloat(a.allocated));
  }

  // Get trailing 4-week averages for historical fallback
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const [historicalAvg] = await db
    .select({
      avgReceipts: sql<string>`COALESCE(SUM(CASE WHEN ${payments.type} = 'receipt' THEN ${payments.amount} ELSE 0 END) / 4, 0)`,
      avgPayments: sql<string>`COALESCE(SUM(CASE WHEN ${payments.type} = 'payment' THEN ${payments.amount} ELSE 0 END) / 4, 0)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, tenantId),
        eq(payments.status, "posted"),
        gte(payments.paymentDate, fourWeeksAgo.toISOString().split("T")[0])
      )
    );

  const weeklyReceiptsAvg = parseFloat(historicalAvg?.avgReceipts || "0");
  const weeklyPaymentsAvg = parseFloat(historicalAvg?.avgPayments || "0");

  // Build 4-week forecast
  let openingBalance = currentBalance;

  for (let week = 0; week < 4; week++) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + week * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    // Calculate expected receipts from AR due this week
    let receiptsFromAR = 0;
    for (const doc of openAR) {
      const dueDate = doc.dueDate || new Date(new Date(doc.docDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      if (dueDate >= weekStartStr && dueDate <= weekEndStr) {
        const total = parseFloat(doc.totalAmount);
        const allocated = arAllocMap.get(doc.docId) || 0;
        const remaining = total - allocated;
        if (remaining > 0.01) {
          receiptsFromAR += remaining;
        }
      }
    }

    // Calculate expected payments from AP due this week
    let paymentsFromAP = 0;
    for (const doc of openAP) {
      const dueDate = doc.dueDate || new Date(new Date(doc.docDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      if (dueDate >= weekStartStr && dueDate <= weekEndStr) {
        const total = parseFloat(doc.totalAmount);
        const allocated = apAllocMap.get(doc.docId) || 0;
        const remaining = total - allocated;
        if (remaining > 0.01) {
          paymentsFromAP += remaining;
        }
      }
    }

    // Use historical average as fallback if no due dates
    const receiptsFromHistory = receiptsFromAR < 100 ? weeklyReceiptsAvg : 0;
    const paymentsFromHistory = paymentsFromAP < 100 ? weeklyPaymentsAvg : 0;

    const expectedReceipts = receiptsFromAR + receiptsFromHistory;
    const expectedPayments = paymentsFromAP + paymentsFromHistory;
    const closingBalance = openingBalance + expectedReceipts - expectedPayments;

    forecast.push({
      period: week === 0 ? "This Week" : week === 1 ? "Next Week" : `Week ${week + 1}`,
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      openingBalance,
      expectedReceipts,
      expectedPayments,
      closingBalance,
      receiptsFromAR,
      receiptsFromHistory,
      paymentsFromAP,
      paymentsFromHistory,
    });

    openingBalance = closingBalance;
  }

  return forecast;
}
