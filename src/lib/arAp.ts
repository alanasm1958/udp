/**
 * AR/AP Balance Helpers
 *
 * Functions for computing open AR/AP balances, document remaining amounts,
 * and generating party statements.
 */

import { db } from "@/db";
import {
  payments,
  paymentAllocations,
  salesDocs,
  purchaseDocs,
  parties,
} from "@/db/schema";
import { eq, and, sql, gte, lte, desc, asc } from "drizzle-orm";

/**
 * Get total allocated amount for a payment.
 */
export async function getPaymentAllocatedTotal(
  tenantId: string,
  paymentId: string
): Promise<number> {
  const result = await db
    .select({ total: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)` })
    .from(paymentAllocations)
    .where(
      and(
        eq(paymentAllocations.tenantId, tenantId),
        eq(paymentAllocations.paymentId, paymentId)
      )
    );

  return parseFloat(result[0]?.total || "0");
}

/**
 * Get total allocated amount for a document (sales_doc or purchase_doc).
 * Only counts allocations from posted payments.
 */
export async function getDocAllocatedTotal(
  tenantId: string,
  targetType: "sales_doc" | "purchase_doc",
  targetId: string
): Promise<number> {
  const result = await db
    .select({ total: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)` })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .where(
      and(
        eq(paymentAllocations.tenantId, tenantId),
        eq(paymentAllocations.targetType, targetType),
        eq(paymentAllocations.targetId, targetId),
        eq(payments.status, "posted")
      )
    );

  return parseFloat(result[0]?.total || "0");
}

/**
 * Get total allocated amount for a document including draft payments.
 * Used for validation to prevent over-allocation.
 */
export async function getDocAllocatedTotalIncludingDraft(
  tenantId: string,
  targetType: "sales_doc" | "purchase_doc",
  targetId: string
): Promise<number> {
  const result = await db
    .select({ total: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)` })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .where(
      and(
        eq(paymentAllocations.tenantId, tenantId),
        eq(paymentAllocations.targetType, targetType),
        eq(paymentAllocations.targetId, targetId),
        sql`${payments.status} != 'void'`
      )
    );

  return parseFloat(result[0]?.total || "0");
}

export interface DocRemainingResult {
  total: number;
  allocated: number;
  remaining: number;
}

/**
 * Get remaining balance for a sales document.
 */
export async function getSalesDocRemaining(
  tenantId: string,
  salesDocId: string
): Promise<DocRemainingResult | null> {
  const [doc] = await db
    .select({ totalAmount: salesDocs.totalAmount })
    .from(salesDocs)
    .where(
      and(
        eq(salesDocs.tenantId, tenantId),
        eq(salesDocs.id, salesDocId)
      )
    )
    .limit(1);

  if (!doc) return null;

  const total = parseFloat(doc.totalAmount);
  const allocated = await getDocAllocatedTotal(tenantId, "sales_doc", salesDocId);
  const remaining = total - allocated;

  return { total, allocated, remaining };
}

/**
 * Get remaining balance for a purchase document.
 */
export async function getPurchaseDocRemaining(
  tenantId: string,
  purchaseDocId: string
): Promise<DocRemainingResult | null> {
  const [doc] = await db
    .select({ totalAmount: purchaseDocs.totalAmount })
    .from(purchaseDocs)
    .where(
      and(
        eq(purchaseDocs.tenantId, tenantId),
        eq(purchaseDocs.id, purchaseDocId)
      )
    )
    .limit(1);

  if (!doc) return null;

  const total = parseFloat(doc.totalAmount);
  const allocated = await getDocAllocatedTotal(tenantId, "purchase_doc", purchaseDocId);
  const remaining = total - allocated;

  return { total, allocated, remaining };
}

export interface OpenDocItem {
  docId: string;
  docNumber: string;
  docDate: string;
  partyId: string | null;
  partyName: string | null;
  currency: string;
  totalAmount: number;
  allocatedAmount: number;
  remainingAmount: number;
}

export interface OpenDocsResult {
  items: OpenDocItem[];
  summary: {
    totalOpenAmount: number;
    count: number;
  };
}

/**
 * List open AR (sales invoices with remaining balance > 0).
 */
export async function listOpenAR(
  tenantId: string,
  options: { partyId?: string; limit?: number; offset?: number } = {}
): Promise<OpenDocsResult> {
  const { partyId, limit = 50, offset = 0 } = options;

  // Get all posted sales invoices
  const conditions = [
    eq(salesDocs.tenantId, tenantId),
    eq(salesDocs.docType, "invoice"),
    eq(salesDocs.status, "posted"),
  ];

  if (partyId) {
    conditions.push(eq(salesDocs.partyId, partyId));
  }

  const docs = await db
    .select({
      id: salesDocs.id,
      docNumber: salesDocs.docNumber,
      docDate: salesDocs.docDate,
      partyId: salesDocs.partyId,
      partyName: parties.name,
      currency: salesDocs.currency,
      totalAmount: salesDocs.totalAmount,
    })
    .from(salesDocs)
    .leftJoin(parties, eq(salesDocs.partyId, parties.id))
    .where(and(...conditions))
    .orderBy(desc(salesDocs.docDate))
    .limit(limit)
    .offset(offset);

  // Calculate allocated amounts for each doc
  const items: OpenDocItem[] = [];
  let totalOpenAmount = 0;

  for (const doc of docs) {
    const allocated = await getDocAllocatedTotal(tenantId, "sales_doc", doc.id);
    const total = parseFloat(doc.totalAmount);
    const remaining = total - allocated;

    if (remaining > 0.000001) {
      items.push({
        docId: doc.id,
        docNumber: doc.docNumber,
        docDate: doc.docDate,
        partyId: doc.partyId,
        partyName: doc.partyName,
        currency: doc.currency,
        totalAmount: total,
        allocatedAmount: allocated,
        remainingAmount: remaining,
      });
      totalOpenAmount += remaining;
    }
  }

  return {
    items,
    summary: {
      totalOpenAmount,
      count: items.length,
    },
  };
}

/**
 * List open AP (purchase invoices with remaining balance > 0).
 */
export async function listOpenAP(
  tenantId: string,
  options: { partyId?: string; limit?: number; offset?: number } = {}
): Promise<OpenDocsResult> {
  const { partyId, limit = 50, offset = 0 } = options;

  const conditions = [
    eq(purchaseDocs.tenantId, tenantId),
    eq(purchaseDocs.docType, "invoice"),
    eq(purchaseDocs.status, "posted"),
  ];

  if (partyId) {
    conditions.push(eq(purchaseDocs.partyId, partyId));
  }

  const docs = await db
    .select({
      id: purchaseDocs.id,
      docNumber: purchaseDocs.docNumber,
      docDate: purchaseDocs.docDate,
      partyId: purchaseDocs.partyId,
      partyName: parties.name,
      currency: purchaseDocs.currency,
      totalAmount: purchaseDocs.totalAmount,
    })
    .from(purchaseDocs)
    .leftJoin(parties, eq(purchaseDocs.partyId, parties.id))
    .where(and(...conditions))
    .orderBy(desc(purchaseDocs.docDate))
    .limit(limit)
    .offset(offset);

  const items: OpenDocItem[] = [];
  let totalOpenAmount = 0;

  for (const doc of docs) {
    const allocated = await getDocAllocatedTotal(tenantId, "purchase_doc", doc.id);
    const total = parseFloat(doc.totalAmount);
    const remaining = total - allocated;

    if (remaining > 0.000001) {
      items.push({
        docId: doc.id,
        docNumber: doc.docNumber,
        docDate: doc.docDate,
        partyId: doc.partyId,
        partyName: doc.partyName,
        currency: doc.currency,
        totalAmount: total,
        allocatedAmount: allocated,
        remainingAmount: remaining,
      });
      totalOpenAmount += remaining;
    }
  }

  return {
    items,
    summary: {
      totalOpenAmount,
      count: items.length,
    },
  };
}

export interface StatementLine {
  date: string;
  type: "invoice" | "payment";
  reference: string;
  docId: string | null;
  paymentId: string | null;
  amountDebit: number;
  amountCredit: number;
  runningBalance: number;
}

export interface StatementResult {
  partyId: string;
  partyName: string | null;
  lines: StatementLine[];
  openingBalance: number;
  closingBalance: number;
}

/**
 * Get AR statement for a party (customer).
 * Shows invoices as debits and payment allocations as credits.
 */
export async function getARStatement(
  tenantId: string,
  partyId: string,
  options: { from?: string; to?: string } = {}
): Promise<StatementResult | null> {
  const { from, to } = options;

  // Get party
  const [party] = await db
    .select({ id: parties.id, name: parties.name })
    .from(parties)
    .where(and(eq(parties.tenantId, tenantId), eq(parties.id, partyId)))
    .limit(1);

  if (!party) return null;

  // Get invoices
  const invoiceConditions = [
    eq(salesDocs.tenantId, tenantId),
    eq(salesDocs.partyId, partyId),
    eq(salesDocs.docType, "invoice"),
    eq(salesDocs.status, "posted"),
  ];

  if (from) {
    invoiceConditions.push(gte(salesDocs.docDate, from));
  }
  if (to) {
    invoiceConditions.push(lte(salesDocs.docDate, to));
  }

  const invoices = await db
    .select({
      id: salesDocs.id,
      docNumber: salesDocs.docNumber,
      docDate: salesDocs.docDate,
      totalAmount: salesDocs.totalAmount,
    })
    .from(salesDocs)
    .where(and(...invoiceConditions))
    .orderBy(asc(salesDocs.docDate));

  // Get payment allocations for this party's invoices
  const allocationConditions = [
    eq(paymentAllocations.tenantId, tenantId),
    eq(paymentAllocations.targetType, "sales_doc"),
    eq(payments.status, "posted"),
  ];

  if (from) {
    allocationConditions.push(gte(payments.paymentDate, from));
  }
  if (to) {
    allocationConditions.push(lte(payments.paymentDate, to));
  }

  const allocations = await db
    .select({
      paymentId: payments.id,
      paymentDate: payments.paymentDate,
      paymentReference: payments.reference,
      targetId: paymentAllocations.targetId,
      amount: paymentAllocations.amount,
    })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .innerJoin(salesDocs, eq(paymentAllocations.targetId, salesDocs.id))
    .where(
      and(
        ...allocationConditions,
        eq(salesDocs.partyId, partyId)
      )
    )
    .orderBy(asc(payments.paymentDate));

  // Build statement lines
  const entries: Array<{ date: string; sortKey: string } & Omit<StatementLine, "runningBalance">> = [];

  for (const inv of invoices) {
    entries.push({
      date: inv.docDate,
      sortKey: `${inv.docDate}_0_${inv.id}`,
      type: "invoice",
      reference: inv.docNumber,
      docId: inv.id,
      paymentId: null,
      amountDebit: parseFloat(inv.totalAmount),
      amountCredit: 0,
    });
  }

  for (const alloc of allocations) {
    entries.push({
      date: alloc.paymentDate,
      sortKey: `${alloc.paymentDate}_1_${alloc.paymentId}`,
      type: "payment",
      reference: alloc.paymentReference || alloc.paymentId,
      docId: alloc.targetId,
      paymentId: alloc.paymentId,
      amountDebit: 0,
      amountCredit: parseFloat(alloc.amount),
    });
  }

  // Sort by date, then invoices before payments on same date
  entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  // Calculate running balance
  let runningBalance = 0;
  const lines: StatementLine[] = entries.map((entry) => {
    runningBalance += entry.amountDebit - entry.amountCredit;
    return {
      date: entry.date,
      type: entry.type,
      reference: entry.reference,
      docId: entry.docId,
      paymentId: entry.paymentId,
      amountDebit: entry.amountDebit,
      amountCredit: entry.amountCredit,
      runningBalance,
    };
  });

  return {
    partyId,
    partyName: party.name,
    lines,
    openingBalance: 0,
    closingBalance: runningBalance,
  };
}

/**
 * Get AP statement for a party (vendor).
 * Shows invoices as credits and payment allocations as debits.
 */
export async function getAPStatement(
  tenantId: string,
  partyId: string,
  options: { from?: string; to?: string } = {}
): Promise<StatementResult | null> {
  const { from, to } = options;

  // Get party
  const [party] = await db
    .select({ id: parties.id, name: parties.name })
    .from(parties)
    .where(and(eq(parties.tenantId, tenantId), eq(parties.id, partyId)))
    .limit(1);

  if (!party) return null;

  // Get invoices
  const invoiceConditions = [
    eq(purchaseDocs.tenantId, tenantId),
    eq(purchaseDocs.partyId, partyId),
    eq(purchaseDocs.docType, "invoice"),
    eq(purchaseDocs.status, "posted"),
  ];

  if (from) {
    invoiceConditions.push(gte(purchaseDocs.docDate, from));
  }
  if (to) {
    invoiceConditions.push(lte(purchaseDocs.docDate, to));
  }

  const invoices = await db
    .select({
      id: purchaseDocs.id,
      docNumber: purchaseDocs.docNumber,
      docDate: purchaseDocs.docDate,
      totalAmount: purchaseDocs.totalAmount,
    })
    .from(purchaseDocs)
    .where(and(...invoiceConditions))
    .orderBy(asc(purchaseDocs.docDate));

  // Get payment allocations for this party's invoices
  const allocationConditions = [
    eq(paymentAllocations.tenantId, tenantId),
    eq(paymentAllocations.targetType, "purchase_doc"),
    eq(payments.status, "posted"),
  ];

  if (from) {
    allocationConditions.push(gte(payments.paymentDate, from));
  }
  if (to) {
    allocationConditions.push(lte(payments.paymentDate, to));
  }

  const allocations = await db
    .select({
      paymentId: payments.id,
      paymentDate: payments.paymentDate,
      paymentReference: payments.reference,
      targetId: paymentAllocations.targetId,
      amount: paymentAllocations.amount,
    })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .innerJoin(purchaseDocs, eq(paymentAllocations.targetId, purchaseDocs.id))
    .where(
      and(
        ...allocationConditions,
        eq(purchaseDocs.partyId, partyId)
      )
    )
    .orderBy(asc(payments.paymentDate));

  // Build statement lines
  const entries: Array<{ date: string; sortKey: string } & Omit<StatementLine, "runningBalance">> = [];

  for (const inv of invoices) {
    entries.push({
      date: inv.docDate,
      sortKey: `${inv.docDate}_0_${inv.id}`,
      type: "invoice",
      reference: inv.docNumber,
      docId: inv.id,
      paymentId: null,
      amountDebit: 0,
      amountCredit: parseFloat(inv.totalAmount), // AP: invoice is credit (liability)
    });
  }

  for (const alloc of allocations) {
    entries.push({
      date: alloc.paymentDate,
      sortKey: `${alloc.paymentDate}_1_${alloc.paymentId}`,
      type: "payment",
      reference: alloc.paymentReference || alloc.paymentId,
      docId: alloc.targetId,
      paymentId: alloc.paymentId,
      amountDebit: parseFloat(alloc.amount), // AP: payment is debit (reduces liability)
      amountCredit: 0,
    });
  }

  // Sort by date, then invoices before payments on same date
  entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  // Calculate running balance (AP: credits minus debits)
  let runningBalance = 0;
  const lines: StatementLine[] = entries.map((entry) => {
    runningBalance += entry.amountCredit - entry.amountDebit;
    return {
      date: entry.date,
      type: entry.type,
      reference: entry.reference,
      docId: entry.docId,
      paymentId: entry.paymentId,
      amountDebit: entry.amountDebit,
      amountCredit: entry.amountCredit,
      runningBalance,
    };
  });

  return {
    partyId,
    partyName: party.name,
    lines,
    openingBalance: 0,
    closingBalance: runningBalance,
  };
}

/**
 * Compute payment status for a document based on remaining balance.
 */
export function computePaymentStatus(
  total: number,
  remaining: number
): "unpaid" | "partial" | "paid" {
  if (remaining >= total - 0.000001) return "unpaid";
  if (remaining <= 0.000001) return "paid";
  return "partial";
}
