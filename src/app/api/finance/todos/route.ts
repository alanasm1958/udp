import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesDocs, purchaseDocs, payments, paymentAllocations } from "@/db/schema";
import { eq, and, sql, lte, count, sum } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const weekFromNowStr = weekFromNow.toISOString().split("T")[0];

    const todos: Array<{
      id: string;
      type: "urgent" | "important" | "routine";
      category: string;
      title: string;
      description: string;
      count?: number;
      amount?: number;
      dueDate?: string;
      action: string;
      actionRoute?: string;
    }> = [];

    // 1. Bills Due Today
    try {
      const [billsDueToday] = await db
        .select({
          count: count(),
          total: sum(purchaseDocs.totalAmount),
        })
        .from(purchaseDocs)
        .where(
          and(
            eq(purchaseDocs.tenantId, tenantId),
            sql`${purchaseDocs.status} IN ('posted', 'approved')`,
            eq(purchaseDocs.dueDate, todayStr)
          )
        );

      if (billsDueToday && billsDueToday.count > 0) {
        todos.push({
          id: "bills-due-today",
          type: "urgent",
          category: "payables",
          title: `Pay ${billsDueToday.count} bill${billsDueToday.count > 1 ? "s" : ""} due today`,
          description: "These bills are due today - paying on time protects your vendor relationships",
          count: billsDueToday.count,
          amount: parseFloat(billsDueToday.total || "0"),
          dueDate: todayStr,
          action: "Pay Now",
          actionRoute: "/finance/ap",
        });
      }
    } catch (error) {
      console.error("Error fetching bills due today:", error);
    }

    // 2. Draft Payments
    try {
      const [draftPayments] = await db
        .select({
          count: count(),
          total: sum(payments.amount),
        })
        .from(payments)
        .where(
          and(
            eq(payments.tenantId, tenantId),
            eq(payments.status, "draft")
          )
        );

      if (draftPayments && draftPayments.count > 0) {
        todos.push({
          id: "draft-payments",
          type: "urgent",
          category: "transactions",
          title: `${draftPayments.count} draft payment${draftPayments.count > 1 ? "s" : ""} to finalize`,
          description: "These payments aren't in your books yet - finish them for accurate numbers",
          count: draftPayments.count,
          amount: parseFloat(draftPayments.total || "0"),
          action: "Review",
          actionRoute: "/finance/payments?status=draft",
        });
      }
    } catch (error) {
      console.error("Error fetching draft payments:", error);
    }

    // 3. Bills Due This Week
    try {
      const [billsDueThisWeek] = await db
        .select({
          count: count(),
          total: sum(purchaseDocs.totalAmount),
        })
        .from(purchaseDocs)
        .where(
          and(
            eq(purchaseDocs.tenantId, tenantId),
            sql`${purchaseDocs.status} IN ('posted', 'approved')`,
            sql`${purchaseDocs.dueDate} > ${todayStr}`,
            lte(purchaseDocs.dueDate, weekFromNowStr)
          )
        );

      if (billsDueThisWeek && billsDueThisWeek.count > 0) {
        todos.push({
          id: "bills-due-week",
          type: "important",
          category: "payables",
          title: `${billsDueThisWeek.count} bill${billsDueThisWeek.count > 1 ? "s" : ""} due this week`,
          description: "Plan ahead to ensure you have cash available",
          count: billsDueThisWeek.count,
          amount: parseFloat(billsDueThisWeek.total || "0"),
          action: "Schedule",
          actionRoute: "/finance/ap",
        });
      }
    } catch (error) {
      console.error("Error fetching bills due this week:", error);
    }

    // Sort todos by priority
    const priorityOrder = { urgent: 0, important: 1, routine: 2 };
    todos.sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type]);

    return NextResponse.json({
      todos: todos.slice(0, limit),
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching finance todos:", error);
    return NextResponse.json({ error: "Failed to fetch todos" }, { status: 500 });
  }
}
