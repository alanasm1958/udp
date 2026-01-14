/**
 * /api/grc/alerts
 *
 * GET: Generate alerts based on deterministic business rules + stored GRC alerts
 *
 * Alert types:
 * - ar_aging: Overdue AR invoices (30/60/90 days)
 * - ap_due: Upcoming/overdue AP invoices
 * - low_inventory: Products below reorder threshold
 * - fulfillment_pending: Orders awaiting fulfillment
 * - compliance: GRC compliance alerts from requirements
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import {
  salesDocs,
  purchaseDocs,
  payments,
  paymentAllocations,
  inventoryBalances,
  products,
  parties,
  masterAlerts,
  grcRequirements,
} from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export interface Alert {
  id: string;
  type: "ar_aging" | "ap_due" | "low_inventory" | "fulfillment_pending" | "compliance";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  domain: "finance" | "inventory" | "sales" | "procurement" | "grc";
  createdAt: string;
  metadata: Record<string, unknown>;
  actions: {
    plannerUrl?: string;
    createTask?: boolean;
    createCard?: boolean;
  };
  // GRC-specific fields
  requirementId?: string;
  requirementTitle?: string;
  alertType?: string;
  status?: "active" | "resolved";
}

function getDaysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * GET /api/grc/alerts
 * Returns generated alerts based on business rules
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const alerts: Alert[] = [];

    // === AR Aging Alerts ===
    // Get posted sales invoices
    const salesInvoices = await db
      .select({
        id: salesDocs.id,
        docNumber: salesDocs.docNumber,
        docDate: salesDocs.docDate,
        partyId: salesDocs.partyId,
        partyName: parties.name,
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

    // Group AR by aging buckets
    const arAging = {
      over90: { count: 0, total: 0, docs: [] as typeof salesInvoices },
      over60: { count: 0, total: 0, docs: [] as typeof salesInvoices },
      over30: { count: 0, total: 0, docs: [] as typeof salesInvoices },
    };

    for (const inv of salesInvoices) {
      // Get allocated amount
      const allocResult = await db
        .select({
          allocated: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)`,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
        .where(
          and(
            eq(paymentAllocations.tenantId, tenantId),
            eq(paymentAllocations.targetType, "sales_doc"),
            eq(paymentAllocations.targetId, inv.id),
            eq(payments.status, "posted")
          )
        );

      const allocated = parseFloat(allocResult[0]?.allocated || "0");
      const total = parseFloat(inv.totalAmount);
      const remaining = total - allocated;

      if (remaining > 0.01) {
        const days = getDaysSince(inv.docDate);

        if (days > 90) {
          arAging.over90.count++;
          arAging.over90.total += remaining;
          arAging.over90.docs.push(inv);
        } else if (days > 60) {
          arAging.over60.count++;
          arAging.over60.total += remaining;
          arAging.over60.docs.push(inv);
        } else if (days > 30) {
          arAging.over30.count++;
          arAging.over30.total += remaining;
          arAging.over30.docs.push(inv);
        }
      }
    }

    // Create AR aging alerts
    if (arAging.over90.count > 0) {
      alerts.push({
        id: `ar-90-${tenantId}`,
        type: "ar_aging",
        severity: "high",
        title: "Overdue AR over 90 days",
        description: `${arAging.over90.count} invoice${arAging.over90.count > 1 ? "s" : ""} totaling ${formatCurrency(arAging.over90.total)} ${arAging.over90.count > 1 ? "are" : "is"} overdue by more than 90 days`,
        domain: "finance",
        createdAt: new Date().toISOString(),
        metadata: {
          count: arAging.over90.count,
          total: arAging.over90.total,
          bucket: "90+",
        },
        actions: {
          plannerUrl: "/finance/ar",
          createTask: true,
          createCard: true,
        },
      });
    }

    if (arAging.over60.count > 0) {
      alerts.push({
        id: `ar-60-${tenantId}`,
        type: "ar_aging",
        severity: "medium",
        title: "Overdue AR over 60 days",
        description: `${arAging.over60.count} invoice${arAging.over60.count > 1 ? "s" : ""} totaling ${formatCurrency(arAging.over60.total)} ${arAging.over60.count > 1 ? "are" : "is"} overdue by 60-90 days`,
        domain: "finance",
        createdAt: new Date().toISOString(),
        metadata: {
          count: arAging.over60.count,
          total: arAging.over60.total,
          bucket: "60-90",
        },
        actions: {
          plannerUrl: "/finance/ar",
          createTask: true,
          createCard: true,
        },
      });
    }

    if (arAging.over30.count > 0) {
      alerts.push({
        id: `ar-30-${tenantId}`,
        type: "ar_aging",
        severity: "low",
        title: "Overdue AR over 30 days",
        description: `${arAging.over30.count} invoice${arAging.over30.count > 1 ? "s" : ""} totaling ${formatCurrency(arAging.over30.total)} ${arAging.over30.count > 1 ? "are" : "is"} overdue by 30-60 days`,
        domain: "finance",
        createdAt: new Date().toISOString(),
        metadata: {
          count: arAging.over30.count,
          total: arAging.over30.total,
          bucket: "30-60",
        },
        actions: {
          plannerUrl: "/finance/ar",
          createTask: true,
          createCard: true,
        },
      });
    }

    // === Low Inventory Alerts ===
    // Get products with low or zero inventory
    // Note: reorderPoint is not in the schema, so we check for zero/low available quantity
    const inventoryData = await db
      .select({
        productId: inventoryBalances.productId,
        productName: products.name,
        productSku: products.sku,
        onHand: inventoryBalances.onHand,
        reserved: inventoryBalances.reserved,
        available: inventoryBalances.available,
      })
      .from(inventoryBalances)
      .innerJoin(products, eq(inventoryBalances.productId, products.id))
      .where(eq(inventoryBalances.tenantId, tenantId));

    // Group by product and sum quantities
    const productInventory = new Map<
      string,
      {
        name: string;
        sku: string | null;
        onHand: number;
        available: number;
      }
    >();

    for (const inv of inventoryData) {
      const existing = productInventory.get(inv.productId);
      if (existing) {
        existing.onHand += parseFloat(inv.onHand);
        existing.available += parseFloat(inv.available);
      } else {
        productInventory.set(inv.productId, {
          name: inv.productName,
          sku: inv.productSku,
          onHand: parseFloat(inv.onHand),
          available: parseFloat(inv.available),
        });
      }
    }

    // Check for low inventory (available <= 0 or available < 10% of on-hand)
    const lowStockProducts: Array<{ name: string; available: number; onHand: number }> = [];
    const zeroStockProducts: Array<{ name: string }> = [];

    for (const [, product] of productInventory) {
      if (product.available <= 0) {
        zeroStockProducts.push({ name: product.name });
      } else if (product.onHand > 0 && product.available < product.onHand * 0.1) {
        // Less than 10% available of on-hand (mostly reserved)
        lowStockProducts.push({
          name: product.name,
          available: product.available,
          onHand: product.onHand,
        });
      }
    }

    if (zeroStockProducts.length > 0) {
      alerts.push({
        id: `inv-zero-${tenantId}`,
        type: "low_inventory",
        severity: "high",
        title: "Out of stock items",
        description: `${zeroStockProducts.length} product${zeroStockProducts.length > 1 ? "s are" : " is"} out of stock`,
        domain: "inventory",
        createdAt: new Date().toISOString(),
        metadata: {
          count: zeroStockProducts.length,
          products: zeroStockProducts.slice(0, 5).map((p) => p.name),
        },
        actions: {
          plannerUrl: "/inventory/balances",
          createTask: true,
          createCard: true,
        },
      });
    }

    if (lowStockProducts.length > 0) {
      alerts.push({
        id: `inv-low-${tenantId}`,
        type: "low_inventory",
        severity: "medium",
        title: "Low available inventory",
        description: `${lowStockProducts.length} product${lowStockProducts.length > 1 ? "s have" : " has"} less than 10% available`,
        domain: "inventory",
        createdAt: new Date().toISOString(),
        metadata: {
          count: lowStockProducts.length,
          products: lowStockProducts.slice(0, 5).map((p) => ({
            name: p.name,
            available: p.available,
            onHand: p.onHand,
          })),
        },
        actions: {
          plannerUrl: "/inventory/balances",
          createTask: true,
          createCard: true,
        },
      });
    }

    // === AP Due Alerts ===
    // Get posted purchase invoices
    const purchaseInvoices = await db
      .select({
        id: purchaseDocs.id,
        docNumber: purchaseDocs.docNumber,
        docDate: purchaseDocs.docDate,
        dueDate: purchaseDocs.dueDate,
        partyId: purchaseDocs.partyId,
        partyName: parties.name,
        totalAmount: purchaseDocs.totalAmount,
      })
      .from(purchaseDocs)
      .leftJoin(parties, eq(purchaseDocs.partyId, parties.id))
      .where(
        and(
          eq(purchaseDocs.tenantId, tenantId),
          eq(purchaseDocs.docType, "invoice"),
          eq(purchaseDocs.status, "posted")
        )
      )
      .orderBy(desc(purchaseDocs.docDate));

    const apOverdue = { count: 0, total: 0 };
    const apDueSoon = { count: 0, total: 0 };
    const today = new Date().toISOString().split("T")[0];
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    for (const inv of purchaseInvoices) {
      // Get allocated amount
      const allocResult = await db
        .select({
          allocated: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)`,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
        .where(
          and(
            eq(paymentAllocations.tenantId, tenantId),
            eq(paymentAllocations.targetType, "purchase_doc"),
            eq(paymentAllocations.targetId, inv.id),
            eq(payments.status, "posted")
          )
        );

      const allocated = parseFloat(allocResult[0]?.allocated || "0");
      const total = parseFloat(inv.totalAmount);
      const remaining = total - allocated;

      if (remaining > 0.01) {
        const dueDate = inv.dueDate || inv.docDate;
        if (dueDate < today) {
          apOverdue.count++;
          apOverdue.total += remaining;
        } else if (dueDate <= sevenDaysFromNow) {
          apDueSoon.count++;
          apDueSoon.total += remaining;
        }
      }
    }

    if (apOverdue.count > 0) {
      alerts.push({
        id: `ap-overdue-${tenantId}`,
        type: "ap_due",
        severity: "high",
        title: "Overdue vendor invoices",
        description: `${apOverdue.count} invoice${apOverdue.count > 1 ? "s" : ""} totaling ${formatCurrency(apOverdue.total)} ${apOverdue.count > 1 ? "are" : "is"} past due`,
        domain: "procurement",
        createdAt: new Date().toISOString(),
        metadata: {
          count: apOverdue.count,
          total: apOverdue.total,
        },
        actions: {
          plannerUrl: "/finance/ap",
          createTask: true,
          createCard: true,
        },
      });
    }

    if (apDueSoon.count > 0) {
      alerts.push({
        id: `ap-due-soon-${tenantId}`,
        type: "ap_due",
        severity: "low",
        title: "Vendor invoices due soon",
        description: `${apDueSoon.count} invoice${apDueSoon.count > 1 ? "s" : ""} totaling ${formatCurrency(apDueSoon.total)} ${apDueSoon.count > 1 ? "are" : "is"} due within 7 days`,
        domain: "procurement",
        createdAt: new Date().toISOString(),
        metadata: {
          count: apDueSoon.count,
          total: apDueSoon.total,
        },
        actions: {
          plannerUrl: "/finance/ap",
          createTask: true,
          createCard: true,
        },
      });
    }

    // === Fulfillment Pending Alerts ===
    // Get posted sales orders/invoices without complete fulfillment
    const pendingFulfillment = await db
      .select({
        id: salesDocs.id,
        docNumber: salesDocs.docNumber,
        docDate: salesDocs.docDate,
        partyName: parties.name,
      })
      .from(salesDocs)
      .leftJoin(parties, eq(salesDocs.partyId, parties.id))
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "order"),
          eq(salesDocs.status, "posted")
        )
      )
      .orderBy(desc(salesDocs.docDate))
      .limit(100);

    if (pendingFulfillment.length > 0) {
      const oldOrders = pendingFulfillment.filter(
        (o) => getDaysSince(o.docDate) > 7
      );

      if (oldOrders.length > 0) {
        alerts.push({
          id: `fulfill-pending-${tenantId}`,
          type: "fulfillment_pending",
          severity: "medium",
          title: "Orders awaiting fulfillment",
          description: `${oldOrders.length} order${oldOrders.length > 1 ? "s" : ""} pending for more than 7 days`,
          domain: "sales",
          createdAt: new Date().toISOString(),
          metadata: {
            count: oldOrders.length,
            orders: oldOrders.slice(0, 5).map((o) => o.docNumber),
          },
          actions: {
            plannerUrl: "/operations/fulfillment",
            createTask: true,
            createCard: true,
          },
        });
      }
    }

    // === GRC Compliance Alerts ===
    // Get stored alerts from master_alerts table (domain='grc', category='compliance')
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const grcAlertsConditions = [
      eq(masterAlerts.tenantId, tenantId),
      eq(masterAlerts.domain, "grc"),
    ];
    if (statusFilter) {
      grcAlertsConditions.push(eq(masterAlerts.status, statusFilter as typeof masterAlerts.status.enumValues[number]));
    }

    const storedAlerts = await db
      .select({
        id: masterAlerts.id,
        requirementId: masterAlerts.requirementId,
        requirementTitle: grcRequirements.title,
        title: masterAlerts.title,
        message: masterAlerts.message,
        alertType: masterAlerts.alertType,
        severity: masterAlerts.severity,
        status: masterAlerts.status,
        createdAt: masterAlerts.createdAt,
      })
      .from(masterAlerts)
      .leftJoin(grcRequirements, eq(masterAlerts.requirementId, grcRequirements.id))
      .where(and(...grcAlertsConditions))
      .orderBy(desc(masterAlerts.createdAt))
      .limit(100);

    for (const alert of storedAlerts) {
      const severityMap: Record<string, "high" | "medium" | "low"> = {
        critical: "high",
        warning: "medium",
        info: "low",
      };

      alerts.push({
        id: alert.id,
        type: "compliance",
        severity: severityMap[alert.severity] || "medium",
        title: alert.title,
        description: alert.message || "",
        domain: "grc",
        createdAt: alert.createdAt.toISOString(),
        metadata: {
          alertType: alert.alertType,
        },
        actions: {
          plannerUrl: alert.requirementId ? `/grc/requirements/${alert.requirementId}` : "/grc",
          createTask: true,
          createCard: true,
        },
        requirementId: alert.requirementId || undefined,
        requirementTitle: alert.requirementTitle || undefined,
        alertType: alert.alertType || undefined,
        status: alert.status,
      });
    }

    // Sort alerts by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return NextResponse.json({
      items: alerts,
      total: alerts.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/grc/alerts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
