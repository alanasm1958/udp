/**
 * /api/sales-customers/metrics
 *
 * GET: Returns sales & customers metrics for the Overview page
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesDocs, parties, salespersons, leads, tasks, alerts } from "@/db/schema";
import { eq, and, sql, gte, isNull, or } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/sales-customers/metrics
 * Returns sales-focused metrics for the Overview page
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalCustomers,
      activeCustomers,
      totalPartners,
      totalSalespersons,
      openQuotes,
      openQuotesValue,
      postedInvoices,
      postedInvoicesValue,
      openAR,
      newLeads,
      qualifiedLeads,
      salesTasks,
      salesAlerts,
    ] = await Promise.all([
      // Total customers
      db
        .select({ count: sql<number>`count(*)` })
        .from(parties)
        .where(and(eq(parties.tenantId, tenantId), eq(parties.type, "customer")))
        .then((r) => r[0]?.count ?? 0),

      // Active customers (with sales in last 30 days)
      db
        .select({ count: sql<number>`count(DISTINCT ${salesDocs.partyId})` })
        .from(salesDocs)
        .where(
          and(
            eq(salesDocs.tenantId, tenantId),
            eq(salesDocs.docType, "invoice"),
            gte(salesDocs.docDate, thirtyDaysAgo.toISOString().split("T")[0])
          )
        )
        .then((r) => r[0]?.count ?? 0),

      // Total partners
      db
        .select({ count: sql<number>`count(*)` })
        .from(parties)
        .where(and(eq(parties.tenantId, tenantId), eq(parties.type, "other")))
        .then((r) => r[0]?.count ?? 0),

      // Total salespersons
      db
        .select({ count: sql<number>`count(*)` })
        .from(salespersons)
        .where(and(eq(salespersons.tenantId, tenantId), eq(salespersons.isActive, true)))
        .then((r) => r[0]?.count ?? 0),

      // Open quotes count
      db
        .select({ count: sql<number>`count(*)` })
        .from(salesDocs)
        .where(
          and(
            eq(salesDocs.tenantId, tenantId),
            eq(salesDocs.docType, "quote"),
            or(eq(salesDocs.status, "draft"), eq(salesDocs.status, "sent"))
          )
        )
        .then((r) => r[0]?.count ?? 0),

      // Open quotes value
      db
        .select({ total: sql<string>`COALESCE(SUM(${salesDocs.totalAmount}), 0)` })
        .from(salesDocs)
        .where(
          and(
            eq(salesDocs.tenantId, tenantId),
            eq(salesDocs.docType, "quote"),
            or(eq(salesDocs.status, "draft"), eq(salesDocs.status, "sent"))
          )
        )
        .then((r) => parseFloat(r[0]?.total || "0")),

      // Posted invoices count (last 30 days)
      db
        .select({ count: sql<number>`count(*)` })
        .from(salesDocs)
        .where(
          and(
            eq(salesDocs.tenantId, tenantId),
            eq(salesDocs.docType, "invoice"),
            eq(salesDocs.status, "posted"),
            gte(salesDocs.docDate, thirtyDaysAgo.toISOString().split("T")[0])
          )
        )
        .then((r) => r[0]?.count ?? 0),

      // Posted invoices value (last 30 days)
      db
        .select({ total: sql<string>`COALESCE(SUM(${salesDocs.totalAmount}), 0)` })
        .from(salesDocs)
        .where(
          and(
            eq(salesDocs.tenantId, tenantId),
            eq(salesDocs.docType, "invoice"),
            eq(salesDocs.status, "posted"),
            gte(salesDocs.docDate, thirtyDaysAgo.toISOString().split("T")[0])
          )
        )
        .then((r) => parseFloat(r[0]?.total || "0")),

      // Open AR (posted invoices not fully paid)
      db
        .select({
          total: sql<string>`COALESCE(SUM(${salesDocs.totalAmount}), 0)`,
        })
        .from(salesDocs)
        .where(
          and(
            eq(salesDocs.tenantId, tenantId),
            eq(salesDocs.docType, "invoice"),
            eq(salesDocs.status, "posted")
          )
        )
        .then(async (r) => {
          const invoiceTotal = parseFloat(r[0]?.total || "0");
          // Get allocated payments
          const { paymentAllocations } = await import("@/db/schema");
          const { payments } = await import("@/db/schema");
          const allocResult = await db
            .select({
              total: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)`,
            })
            .from(paymentAllocations)
            .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
            .where(
              and(
                eq(paymentAllocations.tenantId, tenantId),
                eq(paymentAllocations.targetType, "sales_doc"),
                eq(payments.status, "posted")
              )
            );
          const allocated = parseFloat(allocResult[0]?.total || "0");
          return invoiceTotal - allocated;
        }),

      // New leads (last 30 days)
      db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(
          and(
            eq(leads.tenantId, tenantId),
            eq(leads.status, "new"),
            gte(leads.createdAt, thirtyDaysAgo)
          )
        )
        .then((r) => r[0]?.count ?? 0),

      // Qualified leads
      db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(
          and(
            eq(leads.tenantId, tenantId),
            eq(leads.status, "qualified")
          )
        )
        .then((r) => r[0]?.count ?? 0),

      // Sales tasks (domain = sales, status = open)
      db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(
          and(
            eq(tasks.tenantId, tenantId),
            eq(tasks.domain, "sales"),
            or(eq(tasks.status, "open"), eq(tasks.status, "in_progress"))
          )
        )
        .then((r) => r[0]?.count ?? 0),

      // Sales alerts (domain = sales, status = active)
      db
        .select({ count: sql<number>`count(*)` })
        .from(alerts)
        .where(
          and(
            eq(alerts.tenantId, tenantId),
            eq(alerts.domain, "sales"),
            eq(alerts.status, "active")
          )
        )
        .then((r) => r[0]?.count ?? 0),
    ]);

    return NextResponse.json({
      metrics: {
        totalCustomers: Number(totalCustomers),
        activeCustomers: Number(activeCustomers),
        totalPartners: Number(totalPartners),
        totalSalespersons: Number(totalSalespersons),
        openQuotes: Number(openQuotes),
        openQuotesValue: Number(openQuotesValue),
        postedInvoices: Number(postedInvoices),
        postedInvoicesValue: Number(postedInvoicesValue),
        openAR: Number(openAR),
        newLeads: Number(newLeads),
        qualifiedLeads: Number(qualifiedLeads),
        salesTasksCount: Number(salesTasks),
        salesAlertsCount: Number(salesAlerts),
      },
    });
  } catch (error) {
    console.error("Sales metrics error:", error);
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to fetch sales metrics" },
      { status: 500 }
    );
  }
}
