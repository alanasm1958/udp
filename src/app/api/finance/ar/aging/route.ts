/**
 * /api/finance/ar/aging
 *
 * GET: AR Aging Report - shows receivables grouped by aging buckets
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesDocs, parties, payments, paymentAllocations } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

interface AgingBucket {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

interface CustomerAging {
  customerId: string;
  customerName: string;
  customerCode: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
  oldestInvoiceDate: string;
  invoiceCount: number;
}

interface InvoiceAging {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  daysOverdue: number;
  originalAmount: number;
  paidAmount: number;
  openAmount: number;
  bucket: "current" | "30" | "60" | "90" | "90+";
}

interface AgingResult {
  asOf: string;
  summary: AgingBucket;
  byCustomer: CustomerAging[];
  byInvoice: InvoiceAging[];
}

/**
 * Calculate the aging bucket based on days overdue
 */
function getBucket(daysOverdue: number): "current" | "30" | "60" | "90" | "90+" {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "30";
  if (daysOverdue <= 60) return "60";
  if (daysOverdue <= 90) return "90";
  return "90+";
}

/**
 * GET /api/finance/ar/aging
 * Query params: asOf? (YYYY-MM-DD, defaults to today)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);

    // Parse as-of date (defaults to today)
    const asOfParam = searchParams.get("asOf");
    const asOf = asOfParam || new Date().toISOString().split("T")[0];
    const asOfDate = new Date(asOf);

    // Get all posted sales invoices
    const invoices = await db
      .select({
        id: salesDocs.id,
        docNumber: salesDocs.docNumber,
        docDate: salesDocs.docDate,
        dueDate: salesDocs.dueDate,
        partyId: salesDocs.partyId,
        partyName: parties.name,
        partyCode: parties.code,
        totalAmount: salesDocs.totalAmount,
      })
      .from(salesDocs)
      .leftJoin(parties, eq(salesDocs.partyId, parties.id))
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "invoice"),
          eq(salesDocs.status, "posted")
        )
      )
      .orderBy(desc(salesDocs.docDate));

    // Calculate allocated amounts for each invoice (from posted payments only)
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

    // Create a lookup map for allocations
    const allocationMap = new Map<string, number>();
    for (const alloc of allocationsData) {
      allocationMap.set(alloc.targetId, parseFloat(alloc.allocatedTotal));
    }

    // Calculate aging for each invoice
    const invoiceAgings: InvoiceAging[] = [];
    const customerAgingMap = new Map<string, CustomerAging>();
    const summary: AgingBucket = {
      current: 0,
      days30: 0,
      days60: 0,
      days90: 0,
      over90: 0,
      total: 0,
    };

    for (const inv of invoices) {
      const total = parseFloat(inv.totalAmount);
      const allocated = allocationMap.get(inv.id) || 0;
      const remaining = total - allocated;

      // Skip fully paid invoices
      if (remaining <= 0.000001) continue;

      // Calculate due date: use dueDate if available, otherwise docDate + 30 days
      const invoiceDate = new Date(inv.docDate);
      const dueDate = inv.dueDate
        ? new Date(inv.dueDate)
        : new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Calculate days overdue (positive = overdue, negative = not yet due)
      const daysOverdue = Math.floor((asOfDate.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
      const bucket = getBucket(daysOverdue);

      // Add to invoice list
      invoiceAgings.push({
        invoiceId: inv.id,
        invoiceNumber: inv.docNumber,
        customerId: inv.partyId,
        customerName: inv.partyName || "Unknown",
        invoiceDate: inv.docDate,
        dueDate: dueDate.toISOString().split("T")[0],
        daysOverdue: Math.max(0, daysOverdue),
        originalAmount: total,
        paidAmount: allocated,
        openAmount: remaining,
        bucket,
      });

      // Update summary buckets
      switch (bucket) {
        case "current":
          summary.current += remaining;
          break;
        case "30":
          summary.days30 += remaining;
          break;
        case "60":
          summary.days60 += remaining;
          break;
        case "90":
          summary.days90 += remaining;
          break;
        case "90+":
          summary.over90 += remaining;
          break;
      }
      summary.total += remaining;

      // Update customer aggregation
      const customerId = inv.partyId;
      if (!customerAgingMap.has(customerId)) {
        customerAgingMap.set(customerId, {
          customerId,
          customerName: inv.partyName || "Unknown",
          customerCode: inv.partyCode || "",
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          over90: 0,
          total: 0,
          oldestInvoiceDate: inv.docDate,
          invoiceCount: 0,
        });
      }

      const customerAging = customerAgingMap.get(customerId)!;
      switch (bucket) {
        case "current":
          customerAging.current += remaining;
          break;
        case "30":
          customerAging.days30 += remaining;
          break;
        case "60":
          customerAging.days60 += remaining;
          break;
        case "90":
          customerAging.days90 += remaining;
          break;
        case "90+":
          customerAging.over90 += remaining;
          break;
      }
      customerAging.total += remaining;
      customerAging.invoiceCount += 1;

      // Update oldest invoice date
      if (inv.docDate < customerAging.oldestInvoiceDate) {
        customerAging.oldestInvoiceDate = inv.docDate;
      }
    }

    // Convert customer map to sorted array (by total descending)
    const byCustomer = Array.from(customerAgingMap.values())
      .sort((a, b) => b.total - a.total);

    // Sort invoices by days overdue descending (most overdue first)
    invoiceAgings.sort((a, b) => b.daysOverdue - a.daysOverdue);

    const result: AgingResult = {
      asOf,
      summary,
      byCustomer,
      byInvoice: invoiceAgings,
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/finance/ar/aging error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
