import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  payments,
  salesDocs,
  purchaseDocs,
  journalLines,
  accounts,
  paymentAllocations,
  parties,
} from "@/db/schema";
import { eq, and, sql, sum, gte, lte, or } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // Initialize defaults
    let moneyInBank = 0;
    const bankTrend7d = 0;
    const bankTrend30d = 0;
    let monthCashIn = 0;
    let monthCashOut = 0;
    let totalAR = 0;
    let arCurrent = 0;
    let ar1to30 = 0;
    let ar31to60 = 0;
    let ar60plus = 0;
    let totalAP = 0;
    let apCurrent = 0;
    let ap1to30 = 0;
    let ap31to60 = 0;
    let ap60plus = 0;
    let monthSales = 0;
    let lastMonthSales = 0;
    let monthExpenses = 0;
    let lastMonthExpenses = 0;

    // 1. Cash Position - sum from journal lines for cash/bank accounts
    try {
      const cashAccounts = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.tenantId, tenantId),
            or(
              sql`${accounts.code} LIKE '1010%'`,
              sql`${accounts.code} LIKE '1020%'`
            )
          )
        );

      const cashAccountIds = cashAccounts.map((a) => a.id);

      if (cashAccountIds.length > 0) {
        const [balanceResult] = await db
          .select({
            balance: sql<string>`COALESCE(SUM(${journalLines.debit}) - SUM(${journalLines.credit}), 0)`,
          })
          .from(journalLines)
          .where(
            and(
              eq(journalLines.tenantId, tenantId),
              sql`${journalLines.accountId} IN (${sql.join(cashAccountIds, sql`, `)})`
            )
          );

        moneyInBank = parseFloat(balanceResult?.balance || "0");
      }
    } catch (error) {
      console.error("Error fetching cash position:", error);
    }

    // 2. Monthly Cash Flow from posted payments
    try {
      const [receiptsResult] = await db
        .select({ total: sum(payments.amount) })
        .from(payments)
        .where(
          and(
            eq(payments.tenantId, tenantId),
            eq(payments.type, "receipt"),
            eq(payments.status, "posted"),
            gte(payments.paymentDate, startOfMonth.toISOString().split("T")[0])
          )
        );

      monthCashIn = parseFloat(receiptsResult?.total || "0");

      const [disbursementsResult] = await db
        .select({ total: sum(payments.amount) })
        .from(payments)
        .where(
          and(
            eq(payments.tenantId, tenantId),
            eq(payments.type, "payment"),
            eq(payments.status, "posted"),
            gte(payments.paymentDate, startOfMonth.toISOString().split("T")[0])
          )
        );

      monthCashOut = parseFloat(disbursementsResult?.total || "0");
    } catch (error) {
      console.error("Error fetching cash flow:", error);
    }

    // 3. Accounts Receivable with aging (similar to ar/aging route)
    try {
      const invoices = await db
        .select({
          id: salesDocs.id,
          docDate: salesDocs.docDate,
          dueDate: salesDocs.dueDate,
          totalAmount: salesDocs.totalAmount,
        })
        .from(salesDocs)
        .where(
          and(
            eq(salesDocs.tenantId, tenantId),
            eq(salesDocs.docType, "invoice"),
            eq(salesDocs.status, "posted")
          )
        );

      // Get allocations
      const allocationsData = await db
        .select({
          targetId: paymentAllocations.targetId,
          allocatedTotal: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)`,
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

      const allocationMap = new Map<string, number>();
      for (const alloc of allocationsData) {
        allocationMap.set(alloc.targetId, parseFloat(alloc.allocatedTotal));
      }

      for (const inv of invoices) {
        const total = parseFloat(inv.totalAmount);
        const allocated = allocationMap.get(inv.id) || 0;
        const remaining = total - allocated;
        if (remaining <= 0.001) continue;

        const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.docDate);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        totalAR += remaining;
        if (daysOverdue <= 0) arCurrent += remaining;
        else if (daysOverdue <= 30) ar1to30 += remaining;
        else if (daysOverdue <= 60) ar31to60 += remaining;
        else ar60plus += remaining;
      }
    } catch (error) {
      console.error("Error fetching AR:", error);
    }

    // 4. Accounts Payable with aging
    try {
      const bills = await db
        .select({
          id: purchaseDocs.id,
          docDate: purchaseDocs.docDate,
          dueDate: purchaseDocs.dueDate,
          totalAmount: purchaseDocs.totalAmount,
        })
        .from(purchaseDocs)
        .where(
          and(
            eq(purchaseDocs.tenantId, tenantId),
            eq(purchaseDocs.docType, "invoice"),
            sql`${purchaseDocs.status} IN ('posted', 'approved')`
          )
        );

      // Get AP allocations
      const apAllocationsData = await db
        .select({
          targetId: paymentAllocations.targetId,
          allocatedTotal: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)`,
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

      const apAllocationMap = new Map<string, number>();
      for (const alloc of apAllocationsData) {
        apAllocationMap.set(alloc.targetId, parseFloat(alloc.allocatedTotal));
      }

      for (const bill of bills) {
        const total = parseFloat(bill.totalAmount);
        const allocated = apAllocationMap.get(bill.id) || 0;
        const remaining = total - allocated;
        if (remaining <= 0.001) continue;

        const dueDate = bill.dueDate ? new Date(bill.dueDate) : new Date(bill.docDate);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        totalAP += remaining;
        if (daysOverdue <= 0) apCurrent += remaining;
        else if (daysOverdue <= 30) ap1to30 += remaining;
        else if (daysOverdue <= 60) ap31to60 += remaining;
        else ap60plus += remaining;
      }
    } catch (error) {
      console.error("Error fetching AP:", error);
    }

    // 5. Sales this month
    try {
      const [salesResult] = await db
        .select({ total: sum(salesDocs.totalAmount) })
        .from(salesDocs)
        .where(
          and(
            eq(salesDocs.tenantId, tenantId),
            eq(salesDocs.docType, "invoice"),
            eq(salesDocs.status, "posted"),
            gte(salesDocs.docDate, startOfMonth.toISOString().split("T")[0])
          )
        );

      monthSales = parseFloat(salesResult?.total || "0");

      const [lastMonthSalesResult] = await db
        .select({ total: sum(salesDocs.totalAmount) })
        .from(salesDocs)
        .where(
          and(
            eq(salesDocs.tenantId, tenantId),
            eq(salesDocs.docType, "invoice"),
            eq(salesDocs.status, "posted"),
            gte(salesDocs.docDate, startOfLastMonth.toISOString().split("T")[0]),
            lte(salesDocs.docDate, endOfLastMonth.toISOString().split("T")[0])
          )
        );

      lastMonthSales = parseFloat(lastMonthSalesResult?.total || "0");
    } catch (error) {
      console.error("Error fetching sales:", error);
    }

    // 6. Expenses this month
    try {
      const [expensesResult] = await db
        .select({ total: sum(purchaseDocs.totalAmount) })
        .from(purchaseDocs)
        .where(
          and(
            eq(purchaseDocs.tenantId, tenantId),
            eq(purchaseDocs.docType, "invoice"),
            sql`${purchaseDocs.status} IN ('posted', 'approved')`,
            gte(purchaseDocs.docDate, startOfMonth.toISOString().split("T")[0])
          )
        );

      monthExpenses = parseFloat(expensesResult?.total || "0");

      const [lastMonthExpensesResult] = await db
        .select({ total: sum(purchaseDocs.totalAmount) })
        .from(purchaseDocs)
        .where(
          and(
            eq(purchaseDocs.tenantId, tenantId),
            eq(purchaseDocs.docType, "invoice"),
            sql`${purchaseDocs.status} IN ('posted', 'approved')`,
            gte(purchaseDocs.docDate, startOfLastMonth.toISOString().split("T")[0]),
            lte(purchaseDocs.docDate, endOfLastMonth.toISOString().split("T")[0])
          )
        );

      lastMonthExpenses = parseFloat(lastMonthExpensesResult?.total || "0");
    } catch (error) {
      console.error("Error fetching expenses:", error);
    }

    // Calculate derived metrics
    const avgMonthlyBurn = monthExpenses > 0 ? monthExpenses : 10000;
    const cashRunwayMonths = avgMonthlyBurn > 0 ? moneyInBank / avgMonthlyBurn : 12;
    const monthNetCashFlow = monthCashIn - monthCashOut;
    const netPosition = totalAR - totalAP;
    const monthProfit = monthSales - monthExpenses;
    const profitMargin = monthSales > 0 ? (monthProfit / monthSales) * 100 : 0;

    const salesVsLastMonth = lastMonthSales > 0
      ? ((monthSales - lastMonthSales) / lastMonthSales) * 100
      : 0;
    const expensesVsLastMonth = lastMonthExpenses > 0
      ? ((monthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
      : 0;

    return NextResponse.json({
      analytics: {
        cash: {
          moneyInBank,
          bankTrend7d,
          bankTrend30d,
          cashRunwayMonths: Math.max(0, cashRunwayMonths),
          avgMonthlyBurn,
          monthCashIn,
          monthCashOut,
          monthNetCashFlow,
        },
        owed: {
          totalAR,
          arCurrent,
          ar1to30,
          ar31to60,
          ar60plus,
          totalAP,
          apCurrent,
          ap1to30,
          ap31to60,
          ap60plus,
          netPosition,
        },
        performance: {
          monthSales,
          salesVsLastMonth,
          monthExpenses,
          expensesVsLastMonth,
          monthProfit,
          profitMargin,
        },
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching finance analytics:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
