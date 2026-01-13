import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseDocs, parties, payments, paymentAllocations } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

interface AgingBucket {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
}

interface VendorAging {
  vendorId: string;
  vendorName: string;
  vendorCode: string | null;
  aging: AgingBucket;
  billCount: number;
  oldestBillDate: string;
}

interface BillAging {
  billId: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  billDate: string;
  dueDate: string;
  daysOverdue: number;
  originalAmount: number;
  paidAmount: number;
  openAmount: number;
  bucket: "current" | "1-30" | "31-60" | "61-90" | "90+";
}

function getBucket(daysOverdue: number): "current" | "1-30" | "31-60" | "61-90" | "90+" {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "1-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { searchParams } = new URL(request.url);
    const asOfParam = searchParams.get("asOf");
    const asOf = asOfParam || new Date().toISOString().split("T")[0];
    const asOfDate = new Date(asOf);

    // Fetch all open purchase documents (bills) with vendor info
    const bills = await db
      .select({
        id: purchaseDocs.id,
        docNumber: purchaseDocs.docNumber,
        partyId: purchaseDocs.partyId,
        vendorName: parties.name,
        vendorCode: parties.code,
        docDate: purchaseDocs.docDate,
        dueDate: purchaseDocs.dueDate,
        totalAmount: purchaseDocs.totalAmount,
      })
      .from(purchaseDocs)
      .leftJoin(parties, eq(purchaseDocs.partyId, parties.id))
      .where(
        and(
          eq(purchaseDocs.tenantId, tenantId),
          eq(purchaseDocs.docType, "invoice"),
          sql`${purchaseDocs.status} IN ('posted', 'approved')`
        )
      )
      .orderBy(desc(purchaseDocs.docDate));

    // Calculate allocated amounts for each bill (from posted payments only)
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
          eq(paymentAllocations.targetType, "purchase_doc"),
          eq(payments.status, "posted")
        )
      )
      .groupBy(paymentAllocations.targetId);

    // Create a lookup map for allocations
    const allocationMap = new Map<string, number>();
    for (const alloc of allocationsData) {
      allocationMap.set(alloc.targetId, parseFloat(alloc.allocatedTotal));
    }

    // Group by vendor and calculate aging
    const vendorMap = new Map<string, VendorAging>();
    const billAgings: BillAging[] = [];
    const totals: AgingBucket = {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      days90plus: 0,
      total: 0,
    };

    for (const bill of bills) {
      if (!bill.partyId) continue;

      const total = parseFloat(bill.totalAmount || "0");
      const allocated = allocationMap.get(bill.id) || 0;
      const remaining = total - allocated;

      // Skip fully paid bills
      if (remaining <= 0.000001) continue;

      const dueDate = bill.dueDate ? new Date(bill.dueDate) : new Date(bill.docDate);
      const daysOverdue = Math.floor((asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const bucket = getBucket(daysOverdue);

      // Add to bill list
      billAgings.push({
        billId: bill.id,
        billNumber: bill.docNumber,
        vendorId: bill.partyId,
        vendorName: bill.vendorName || "Unknown Vendor",
        billDate: bill.docDate,
        dueDate: dueDate.toISOString().split("T")[0],
        daysOverdue: Math.max(0, daysOverdue),
        originalAmount: total,
        paidAmount: allocated,
        openAmount: remaining,
        bucket,
      });

      // Get or create vendor entry
      if (!vendorMap.has(bill.partyId)) {
        vendorMap.set(bill.partyId, {
          vendorId: bill.partyId,
          vendorName: bill.vendorName || "Unknown Vendor",
          vendorCode: bill.vendorCode,
          aging: {
            current: 0,
            days1to30: 0,
            days31to60: 0,
            days61to90: 0,
            days90plus: 0,
            total: 0,
          },
          billCount: 0,
          oldestBillDate: bill.docDate,
        });
      }

      const vendorAging = vendorMap.get(bill.partyId)!;
      vendorAging.billCount++;

      // Update oldest bill date
      if (bill.docDate < vendorAging.oldestBillDate) {
        vendorAging.oldestBillDate = bill.docDate;
      }

      // Assign to appropriate bucket
      switch (bucket) {
        case "current":
          vendorAging.aging.current += remaining;
          totals.current += remaining;
          break;
        case "1-30":
          vendorAging.aging.days1to30 += remaining;
          totals.days1to30 += remaining;
          break;
        case "31-60":
          vendorAging.aging.days31to60 += remaining;
          totals.days31to60 += remaining;
          break;
        case "61-90":
          vendorAging.aging.days61to90 += remaining;
          totals.days61to90 += remaining;
          break;
        case "90+":
          vendorAging.aging.days90plus += remaining;
          totals.days90plus += remaining;
          break;
      }

      vendorAging.aging.total += remaining;
      totals.total += remaining;
    }

    // Convert to array and sort by total descending
    const vendors = Array.from(vendorMap.values()).sort(
      (a, b) => b.aging.total - a.aging.total
    );

    // Sort bills by days overdue descending
    billAgings.sort((a, b) => b.daysOverdue - a.daysOverdue);

    return NextResponse.json({
      asOf,
      vendors,
      bills: billAgings,
      totals,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching AP aging:", error);
    return NextResponse.json({ error: "Failed to fetch AP aging" }, { status: 500 });
  }
}
