/**
 * AI Tools - Allowlisted tools for the AI Copilot
 *
 * Each tool fetches tenant-scoped data using internal server functions.
 * Tools must be explicitly defined here to be available to the AI.
 */

import { db } from "@/db";
import {
  accounts,
  journalLines,
  journalEntries,
  inventoryBalances,
  products,
  warehouses,
  salesDocs,
  salesDocLines,
  purchaseDocs,
  purchaseDocLines,
  payments,
  paymentAllocations,
  parties,
} from "@/db/schema";
import { eq, and, lte, desc, sql } from "drizzle-orm";
import type { AIToolDefinition } from "./provider";

export interface ToolContext {
  tenantId: string;
  userId: string;
  actorId: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Tool definitions for the AI
 */
export const TOOL_DEFINITIONS: AIToolDefinition[] = [
  {
    name: "reports_trialBalance",
    description: "Fetch trial balance as of a specific date. Returns account balances summarized by account type.",
    parameters: {
      type: "object",
      properties: {
        asOf: {
          type: "string",
          description: "The as-of date in YYYY-MM-DD format"
        }
      },
      required: ["asOf"]
    }
  },
  {
    name: "reports_generalLedger",
    description: "Fetch general ledger lines for a specific account within a date range.",
    parameters: {
      type: "object",
      properties: {
        accountCode: {
          type: "string",
          description: "The account code to filter by"
        },
        from: {
          type: "string",
          description: "Start date in YYYY-MM-DD format"
        },
        to: {
          type: "string",
          description: "End date in YYYY-MM-DD format"
        },
        limit: {
          type: "number",
          description: "Maximum number of lines to return (default 100, max 1000)"
        }
      },
      required: []
    }
  },
  {
    name: "inventory_balances",
    description: "Fetch inventory balances by product and warehouse.",
    parameters: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description: "Optional product ID to filter by"
        },
        warehouseId: {
          type: "string",
          description: "Optional warehouse ID to filter by"
        },
        limit: {
          type: "number",
          description: "Maximum number of rows (default 50, max 500)"
        }
      },
      required: []
    }
  },
  {
    name: "finance_openAR",
    description: "Fetch open accounts receivable (unpaid sales invoices).",
    parameters: {
      type: "object",
      properties: {
        partyId: {
          type: "string",
          description: "Optional customer party ID to filter by"
        },
        limit: {
          type: "number",
          description: "Maximum number of rows (default 50, max 200)"
        }
      },
      required: []
    }
  },
  {
    name: "finance_openAP",
    description: "Fetch open accounts payable (unpaid purchase invoices).",
    parameters: {
      type: "object",
      properties: {
        partyId: {
          type: "string",
          description: "Optional vendor party ID to filter by"
        },
        limit: {
          type: "number",
          description: "Maximum number of rows (default 50, max 200)"
        }
      },
      required: []
    }
  },
  {
    name: "sales_getDoc",
    description: "Fetch a sales document with its lines and payment status.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The sales document ID"
        },
        docNumber: {
          type: "string",
          description: "Or the document number to search by"
        }
      },
      required: []
    }
  },
  {
    name: "procurement_getDoc",
    description: "Fetch a purchase document with its lines and payment status.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The purchase document ID"
        },
        docNumber: {
          type: "string",
          description: "Or the document number to search by"
        }
      },
      required: []
    }
  },
  {
    name: "finance_getPayment",
    description: "Fetch payment details and allocations.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The payment ID"
        }
      },
      required: ["id"]
    }
  },
  {
    name: "draft_createNote",
    description: "Create an internal note or task draft for the user (non-financial). Returns a draft that can be saved.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Note title"
        },
        content: {
          type: "string",
          description: "Note content"
        }
      },
      required: ["title", "content"]
    }
  }
];

/**
 * Execute a tool by name
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  const { tenantId } = context;

  // Validate tool is in allowlist
  const toolDef = TOOL_DEFINITIONS.find(t => t.name === toolName);
  if (!toolDef) {
    return { success: false, error: `Tool "${toolName}" is not allowed` };
  }

  try {
    switch (toolName) {
      case "reports_trialBalance":
        return await executeTrialBalance(tenantId, args);
      case "reports_generalLedger":
        return await executeGeneralLedger(tenantId, args);
      case "inventory_balances":
        return await executeInventoryBalances(tenantId, args);
      case "finance_openAR":
        return await executeOpenAR(tenantId, args);
      case "finance_openAP":
        return await executeOpenAP(tenantId, args);
      case "sales_getDoc":
        return await executeSalesGetDoc(tenantId, args);
      case "procurement_getDoc":
        return await executeProcurementGetDoc(tenantId, args);
      case "finance_getPayment":
        return await executeGetPayment(tenantId, args);
      case "draft_createNote":
        return await executeCreateNote(context, args);
      default:
        return { success: false, error: `Tool "${toolName}" not implemented` };
    }
  } catch (error) {
    console.error(`Tool ${toolName} error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Tool execution failed"
    };
  }
}

/**
 * Trial Balance tool
 */
async function executeTrialBalance(
  tenantId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const asOfStr = (args.asOf as string) || new Date().toISOString().split("T")[0];
  const asOfDate = new Date(asOfStr + "T23:59:59Z"); // End of day

  // Get account balances up to asOf date
  const results = await db
    .select({
      accountCode: accounts.code,
      accountName: accounts.name,
      accountType: accounts.type,
      debit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)`,
      credit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(accounts)
    .leftJoin(
      journalLines,
      and(
        eq(journalLines.accountId, accounts.id),
        eq(journalLines.tenantId, tenantId)
      )
    )
    .leftJoin(
      journalEntries,
      and(
        eq(journalEntries.id, journalLines.journalEntryId),
        lte(journalEntries.entryDate, asOfDate)
      )
    )
    .where(eq(accounts.tenantId, tenantId))
    .groupBy(accounts.id, accounts.code, accounts.name, accounts.type)
    .limit(500);

  const balances = results.map(r => ({
    code: r.accountCode,
    name: r.accountName,
    type: r.accountType,
    debit: parseFloat(r.debit || "0"),
    credit: parseFloat(r.credit || "0"),
    balance: parseFloat(r.debit || "0") - parseFloat(r.credit || "0")
  })).filter(b => b.debit !== 0 || b.credit !== 0);

  const totals = balances.reduce(
    (acc, b) => ({
      totalDebit: acc.totalDebit + b.debit,
      totalCredit: acc.totalCredit + b.credit
    }),
    { totalDebit: 0, totalCredit: 0 }
  );

  return {
    success: true,
    data: {
      asOf: asOfStr,
      accountCount: balances.length,
      balances: balances.slice(0, 50), // Limit display
      totals,
      isBalanced: Math.abs(totals.totalDebit - totals.totalCredit) < 0.01
    }
  };
}

/**
 * General Ledger tool
 */
async function executeGeneralLedger(
  tenantId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const limit = Math.min(Math.max((args.limit as number) || 100, 1), 1000);
  const from = args.from as string;
  const to = args.to as string;
  const accountCode = args.accountCode as string;

  const conditions = [eq(journalLines.tenantId, tenantId)];

  if (accountCode) {
    const [account] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, accountCode)))
      .limit(1);

    if (account) {
      conditions.push(eq(journalLines.accountId, account.id));
    }
  }

  const lines = await db
    .select({
      entryDate: journalEntries.entryDate,
      accountCode: accounts.code,
      accountName: accounts.name,
      description: journalLines.description,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .where(and(...conditions))
    .orderBy(desc(journalEntries.entryDate))
    .limit(limit);

  return {
    success: true,
    data: {
      lineCount: lines.length,
      dateRange: { from, to },
      lines: lines.map(l => ({
        date: l.entryDate,
        account: `${l.accountCode} - ${l.accountName}`,
        description: l.description,
        debit: parseFloat(l.debit || "0"),
        credit: parseFloat(l.credit || "0")
      }))
    }
  };
}

/**
 * Inventory Balances tool
 */
async function executeInventoryBalances(
  tenantId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const limit = Math.min(Math.max((args.limit as number) || 50, 1), 500);
  const productId = args.productId as string;
  const warehouseId = args.warehouseId as string;

  const conditions = [eq(inventoryBalances.tenantId, tenantId)];

  if (productId) {
    conditions.push(eq(inventoryBalances.productId, productId));
  }
  if (warehouseId) {
    conditions.push(eq(inventoryBalances.warehouseId, warehouseId));
  }

  const balances = await db
    .select({
      productName: products.name,
      productSku: products.sku,
      warehouseName: warehouses.name,
      onHand: inventoryBalances.onHand,
      reserved: inventoryBalances.reserved,
      available: inventoryBalances.available,
    })
    .from(inventoryBalances)
    .innerJoin(products, eq(products.id, inventoryBalances.productId))
    .innerJoin(warehouses, eq(warehouses.id, inventoryBalances.warehouseId))
    .where(and(...conditions))
    .limit(limit);

  return {
    success: true,
    data: {
      count: balances.length,
      balances: balances.map(b => ({
        product: b.productSku ? `${b.productSku} - ${b.productName}` : b.productName,
        warehouse: b.warehouseName,
        onHand: parseFloat(b.onHand || "0"),
        reserved: parseFloat(b.reserved || "0"),
        available: parseFloat(b.available || "0")
      }))
    }
  };
}

/**
 * Open AR tool
 */
async function executeOpenAR(
  tenantId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const limit = Math.min(Math.max((args.limit as number) || 50, 1), 200);
  const partyId = args.partyId as string;

  const conditions = [
    eq(salesDocs.tenantId, tenantId),
    eq(salesDocs.docType, "invoice"),
    eq(salesDocs.status, "posted")
  ];

  if (partyId) {
    conditions.push(eq(salesDocs.partyId, partyId));
  }

  const invoices = await db
    .select({
      id: salesDocs.id,
      docNumber: salesDocs.docNumber,
      docDate: salesDocs.docDate,
      dueDate: salesDocs.dueDate,
      partyName: parties.name,
      totalAmount: salesDocs.totalAmount,
      currency: salesDocs.currency,
    })
    .from(salesDocs)
    .leftJoin(parties, eq(parties.id, salesDocs.partyId))
    .where(and(...conditions))
    .orderBy(desc(salesDocs.docDate))
    .limit(limit);

  // Calculate allocated amounts
  const invoiceIds = invoices.map(i => i.id);
  let allocations: { targetId: string; allocated: string }[] = [];

  if (invoiceIds.length > 0) {
    allocations = await db
      .select({
        targetId: paymentAllocations.targetId,
        allocated: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)`,
      })
      .from(paymentAllocations)
      .where(and(
        eq(paymentAllocations.tenantId, tenantId),
        eq(paymentAllocations.targetType, "sales_doc")
      ))
      .groupBy(paymentAllocations.targetId);
  }

  const allocationMap = new Map(allocations.map(a => [a.targetId, parseFloat(a.allocated || "0")]));

  const openInvoices = invoices.map(inv => {
    const total = parseFloat(inv.totalAmount || "0");
    const paid = allocationMap.get(inv.id) || 0;
    const remaining = total - paid;

    return {
      docNumber: inv.docNumber,
      customer: inv.partyName || "Unknown",
      docDate: inv.docDate,
      dueDate: inv.dueDate,
      total,
      paid,
      remaining,
      currency: inv.currency
    };
  }).filter(inv => inv.remaining > 0.01);

  return {
    success: true,
    data: {
      count: openInvoices.length,
      totalOutstanding: openInvoices.reduce((sum, inv) => sum + inv.remaining, 0),
      invoices: openInvoices
    }
  };
}

/**
 * Open AP tool
 */
async function executeOpenAP(
  tenantId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const limit = Math.min(Math.max((args.limit as number) || 50, 1), 200);
  const partyId = args.partyId as string;

  const conditions = [
    eq(purchaseDocs.tenantId, tenantId),
    eq(purchaseDocs.docType, "invoice"),
    eq(purchaseDocs.status, "posted")
  ];

  if (partyId) {
    conditions.push(eq(purchaseDocs.partyId, partyId));
  }

  const invoices = await db
    .select({
      id: purchaseDocs.id,
      docNumber: purchaseDocs.docNumber,
      docDate: purchaseDocs.docDate,
      dueDate: purchaseDocs.dueDate,
      partyName: parties.name,
      totalAmount: purchaseDocs.totalAmount,
      currency: purchaseDocs.currency,
    })
    .from(purchaseDocs)
    .leftJoin(parties, eq(parties.id, purchaseDocs.partyId))
    .where(and(...conditions))
    .orderBy(desc(purchaseDocs.docDate))
    .limit(limit);

  // Calculate allocated amounts
  const invoiceIds = invoices.map(i => i.id);
  let allocations: { targetId: string; allocated: string }[] = [];

  if (invoiceIds.length > 0) {
    allocations = await db
      .select({
        targetId: paymentAllocations.targetId,
        allocated: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)`,
      })
      .from(paymentAllocations)
      .where(and(
        eq(paymentAllocations.tenantId, tenantId),
        eq(paymentAllocations.targetType, "purchase_doc")
      ))
      .groupBy(paymentAllocations.targetId);
  }

  const allocationMap = new Map(allocations.map(a => [a.targetId, parseFloat(a.allocated || "0")]));

  const openInvoices = invoices.map(inv => {
    const total = parseFloat(inv.totalAmount || "0");
    const paid = allocationMap.get(inv.id) || 0;
    const remaining = total - paid;

    return {
      docNumber: inv.docNumber,
      vendor: inv.partyName || "Unknown",
      docDate: inv.docDate,
      dueDate: inv.dueDate,
      total,
      paid,
      remaining,
      currency: inv.currency
    };
  }).filter(inv => inv.remaining > 0.01);

  return {
    success: true,
    data: {
      count: openInvoices.length,
      totalOutstanding: openInvoices.reduce((sum, inv) => sum + inv.remaining, 0),
      invoices: openInvoices
    }
  };
}

/**
 * Sales Get Doc tool
 */
async function executeSalesGetDoc(
  tenantId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const id = args.id as string;
  const docNumber = args.docNumber as string;

  if (!id && !docNumber) {
    return { success: false, error: "Either id or docNumber is required" };
  }

  const conditions = [eq(salesDocs.tenantId, tenantId)];
  if (id) {
    conditions.push(eq(salesDocs.id, id));
  } else if (docNumber) {
    conditions.push(eq(salesDocs.docNumber, docNumber));
  }

  const [doc] = await db
    .select({
      id: salesDocs.id,
      docType: salesDocs.docType,
      docNumber: salesDocs.docNumber,
      docDate: salesDocs.docDate,
      dueDate: salesDocs.dueDate,
      partyName: parties.name,
      status: salesDocs.status,
      totalAmount: salesDocs.totalAmount,
      currency: salesDocs.currency,
    })
    .from(salesDocs)
    .leftJoin(parties, eq(parties.id, salesDocs.partyId))
    .where(and(...conditions))
    .limit(1);

  if (!doc) {
    return { success: false, error: "Document not found" };
  }

  // Get lines
  const lines = await db
    .select({
      lineNo: salesDocLines.lineNo,
      description: salesDocLines.description,
      quantity: salesDocLines.quantity,
      unitPrice: salesDocLines.unitPrice,
      lineTotal: salesDocLines.lineTotal,
    })
    .from(salesDocLines)
    .where(and(eq(salesDocLines.tenantId, tenantId), eq(salesDocLines.salesDocId, doc.id)));

  return {
    success: true,
    data: {
      document: {
        type: doc.docType,
        number: doc.docNumber,
        date: doc.docDate,
        dueDate: doc.dueDate,
        customer: doc.partyName,
        status: doc.status,
        total: parseFloat(doc.totalAmount || "0"),
        currency: doc.currency
      },
      lines: lines.map(l => ({
        lineNo: l.lineNo,
        description: l.description,
        quantity: parseFloat(l.quantity || "0"),
        unitPrice: parseFloat(l.unitPrice || "0"),
        total: parseFloat(l.lineTotal || "0")
      }))
    }
  };
}

/**
 * Procurement Get Doc tool
 */
async function executeProcurementGetDoc(
  tenantId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const id = args.id as string;
  const docNumber = args.docNumber as string;

  if (!id && !docNumber) {
    return { success: false, error: "Either id or docNumber is required" };
  }

  const conditions = [eq(purchaseDocs.tenantId, tenantId)];
  if (id) {
    conditions.push(eq(purchaseDocs.id, id));
  } else if (docNumber) {
    conditions.push(eq(purchaseDocs.docNumber, docNumber));
  }

  const [doc] = await db
    .select({
      id: purchaseDocs.id,
      docType: purchaseDocs.docType,
      docNumber: purchaseDocs.docNumber,
      docDate: purchaseDocs.docDate,
      dueDate: purchaseDocs.dueDate,
      partyName: parties.name,
      status: purchaseDocs.status,
      totalAmount: purchaseDocs.totalAmount,
      currency: purchaseDocs.currency,
    })
    .from(purchaseDocs)
    .leftJoin(parties, eq(parties.id, purchaseDocs.partyId))
    .where(and(...conditions))
    .limit(1);

  if (!doc) {
    return { success: false, error: "Document not found" };
  }

  // Get lines
  const lines = await db
    .select({
      lineNo: purchaseDocLines.lineNo,
      description: purchaseDocLines.description,
      quantity: purchaseDocLines.quantity,
      unitPrice: purchaseDocLines.unitPrice,
      lineTotal: purchaseDocLines.lineTotal,
    })
    .from(purchaseDocLines)
    .where(and(eq(purchaseDocLines.tenantId, tenantId), eq(purchaseDocLines.purchaseDocId, doc.id)));

  return {
    success: true,
    data: {
      document: {
        type: doc.docType,
        number: doc.docNumber,
        date: doc.docDate,
        dueDate: doc.dueDate,
        vendor: doc.partyName,
        status: doc.status,
        total: parseFloat(doc.totalAmount || "0"),
        currency: doc.currency
      },
      lines: lines.map(l => ({
        lineNo: l.lineNo,
        description: l.description,
        quantity: parseFloat(l.quantity || "0"),
        unitPrice: parseFloat(l.unitPrice || "0"),
        total: parseFloat(l.lineTotal || "0")
      }))
    }
  };
}

/**
 * Get Payment tool
 */
async function executeGetPayment(
  tenantId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const id = args.id as string;

  if (!id) {
    return { success: false, error: "Payment ID is required" };
  }

  const [payment] = await db
    .select({
      id: payments.id,
      type: payments.type,
      method: payments.method,
      status: payments.status,
      paymentDate: payments.paymentDate,
      partyName: parties.name,
      amount: payments.amount,
      currency: payments.currency,
      reference: payments.reference,
      memo: payments.memo,
    })
    .from(payments)
    .leftJoin(parties, eq(parties.id, payments.partyId))
    .where(and(eq(payments.tenantId, tenantId), eq(payments.id, id)))
    .limit(1);

  if (!payment) {
    return { success: false, error: "Payment not found" };
  }

  // Get allocations
  const allocations = await db
    .select({
      targetType: paymentAllocations.targetType,
      targetId: paymentAllocations.targetId,
      amount: paymentAllocations.amount,
    })
    .from(paymentAllocations)
    .where(and(
      eq(paymentAllocations.tenantId, tenantId),
      eq(paymentAllocations.paymentId, id)
    ));

  const totalAllocated = allocations.reduce((sum, a) => sum + parseFloat(a.amount || "0"), 0);
  const paymentAmount = parseFloat(payment.amount || "0");

  return {
    success: true,
    data: {
      payment: {
        id: payment.id,
        type: payment.type,
        method: payment.method,
        status: payment.status,
        date: payment.paymentDate,
        party: payment.partyName,
        amount: paymentAmount,
        currency: payment.currency,
        reference: payment.reference,
        memo: payment.memo
      },
      allocations: allocations.map(a => ({
        type: a.targetType,
        documentId: a.targetId,
        amount: parseFloat(a.amount || "0")
      })),
      summary: {
        totalAmount: paymentAmount,
        totalAllocated,
        unallocated: paymentAmount - totalAllocated
      }
    }
  };
}

/**
 * Create Note draft tool (non-financial)
 */
async function executeCreateNote(
  context: ToolContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const title = args.title as string;
  const content = args.content as string;

  if (!title || !content) {
    return { success: false, error: "Title and content are required" };
  }

  // This returns a draft - doesn't actually create anything
  return {
    success: true,
    data: {
      draft: {
        type: "note",
        title,
        content,
        createdBy: context.userId,
        createdAt: new Date().toISOString()
      },
      message: "Note draft created. Save it from your notes section to persist."
    }
  };
}
