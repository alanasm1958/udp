/**
 * Posting Service - Purchase Document Posting
 *
 * Posts purchase documents (invoices) to the ledger.
 *
 * Creates journal entries:
 * - Dr Inventory (for goods) or Expense (for services)
 * - Cr Accounts Payable
 *
 * THIS MODULE WRITES TO LEDGER TABLES (journal_entries, journal_lines).
 */

import { db } from "@/db";
import {
  transactionSets,
  journalEntries,
  journalLines,
  accounts,
  products,
  purchaseDocs,
  purchaseDocLines,
  purchasePostingLinks,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAuditEvent } from "../audit";

import type {
  PurchaseDocPostingContext,
  PurchaseDocPostingResult,
} from "./types";

/**
 * Post a purchase document (invoice) to the ledger.
 *
 * Creates journal entries:
 * - Dr Inventory (for goods) or Expense (for services)
 * - Cr Accounts Payable
 *
 * THIS FUNCTION WRITES TO LEDGER TABLES (journal_entries, journal_lines).
 */
export async function postPurchaseDoc(ctx: PurchaseDocPostingContext): Promise<PurchaseDocPostingResult> {
  const { tenantId, actorId, purchaseDocId, memo } = ctx;

  // 1. Check for existing posting link (idempotency)
  const existingLink = await db
    .select({
      journalEntryId: purchasePostingLinks.journalEntryId,
      transactionSetId: purchasePostingLinks.transactionSetId,
    })
    .from(purchasePostingLinks)
    .where(
      and(
        eq(purchasePostingLinks.tenantId, tenantId),
        eq(purchasePostingLinks.purchaseDocId, purchaseDocId)
      )
    )
    .limit(1);

  if (existingLink.length > 0) {
    return {
      success: true,
      purchaseDocId,
      journalEntryId: existingLink[0].journalEntryId,
      transactionSetId: existingLink[0].transactionSetId,
      idempotent: true,
    };
  }

  // 2. Fetch purchase document
  const [doc] = await db
    .select()
    .from(purchaseDocs)
    .where(
      and(
        eq(purchaseDocs.id, purchaseDocId),
        eq(purchaseDocs.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!doc) {
    return {
      success: false,
      purchaseDocId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: "Purchase document not found",
    };
  }

  // Only post invoices
  if (doc.docType !== "invoice") {
    return {
      success: false,
      purchaseDocId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: `Cannot post document type: ${doc.docType}. Only invoices can be posted.`,
    };
  }

  try {
    // 3. Resolve accounts
    const apAccountCode = ctx.apAccountCode || "2000";
    const inventoryAccountCode = ctx.inventoryAccountCode || "1400";
    const expenseAccountCode = ctx.expenseAccountCode || "6000";

    const [apAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.code, apAccountCode),
          eq(accounts.isActive, true)
        )
      );

    if (!apAccount) {
      return {
        success: false,
        purchaseDocId,
        journalEntryId: null,
        transactionSetId: null,
        idempotent: false,
        error: `AP account not found: ${apAccountCode}`,
      };
    }

    const [inventoryAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.code, inventoryAccountCode),
          eq(accounts.isActive, true)
        )
      );

    const [expenseAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.code, expenseAccountCode),
          eq(accounts.isActive, true)
        )
      );

    // 4. Fetch purchase doc lines with product info
    const docLines = await db
      .select({
        id: purchaseDocLines.id,
        productId: purchaseDocLines.productId,
        quantity: purchaseDocLines.quantity,
        unitPrice: purchaseDocLines.unitPrice,
        lineTotal: purchaseDocLines.lineTotal,
      })
      .from(purchaseDocLines)
      .where(
        and(
          eq(purchaseDocLines.tenantId, tenantId),
          eq(purchaseDocLines.purchaseDocId, purchaseDocId)
        )
      );

    // 5. Calculate inventory vs expense amounts based on product type
    let inventoryTotal = 0;
    let expenseTotal = 0;

    for (const line of docLines) {
      const lineAmount = parseFloat(line.quantity) * parseFloat(line.unitPrice);

      if (line.productId) {
        const [product] = await db
          .select({ type: products.type })
          .from(products)
          .where(eq(products.id, line.productId))
          .limit(1);

        if (product && product.type === "service") {
          expenseTotal += lineAmount;
        } else {
          inventoryTotal += lineAmount;
        }
      } else {
        // No product, treat as expense
        expenseTotal += lineAmount;
      }
    }

    // 6. Build journal lines
    const docTotal = parseFloat(doc.totalAmount);
    const lines: Array<{
      accountId: string;
      debit: string;
      credit: string;
      description: string | null;
    }> = [];

    // Dr Inventory (for goods)
    if (inventoryTotal > 0 && inventoryAccount) {
      lines.push({
        accountId: inventoryAccount.id,
        debit: inventoryTotal.toFixed(6),
        credit: "0",
        description: `Inventory: ${doc.docNumber}`,
      });
    }

    // Dr Expense (for services)
    if (expenseTotal > 0 && expenseAccount) {
      lines.push({
        accountId: expenseAccount.id,
        debit: expenseTotal.toFixed(6),
        credit: "0",
        description: `Expense: ${doc.docNumber}`,
      });
    }

    // If neither account exists but we have amounts, fallback to AP balance only
    if (lines.length === 0) {
      // Fallback: put everything to expense if available
      if (expenseAccount) {
        lines.push({
          accountId: expenseAccount.id,
          debit: docTotal.toFixed(6),
          credit: "0",
          description: `Purchase: ${doc.docNumber}`,
        });
      } else if (inventoryAccount) {
        lines.push({
          accountId: inventoryAccount.id,
          debit: docTotal.toFixed(6),
          credit: "0",
          description: `Purchase: ${doc.docNumber}`,
        });
      } else {
        return {
          success: false,
          purchaseDocId,
          journalEntryId: null,
          transactionSetId: null,
          idempotent: false,
          error: "No inventory or expense account available for debit entry",
        };
      }
    }

    // Cr AP
    lines.push({
      accountId: apAccount.id,
      debit: "0",
      credit: docTotal.toFixed(6),
      description: `AP: ${doc.docNumber}`,
    });

    // 7. Create transaction set
    const [txSet] = await db
      .insert(transactionSets)
      .values({
        tenantId,
        status: "posted",
        source: "purchase_posting",
        createdByActorId: actorId,
        businessDate: doc.docDate,
        notes: memo || `Purchase posting: ${doc.docNumber}`,
      })
      .returning();

    // 8. Create journal entry - THIS IS THE LEDGER WRITE
    const [journalEntry] = await db
      .insert(journalEntries)
      .values({
        tenantId,
        postingDate: doc.docDate,
        memo: memo || `Purchase invoice: ${doc.docNumber}`,
        sourceTransactionSetId: txSet.id,
        postedByActorId: actorId,
      })
      .returning();

    // 9. Create journal lines - THIS IS THE LEDGER WRITE
    await db.insert(journalLines).values(
      lines.map((line, index) => ({
        tenantId,
        journalEntryId: journalEntry.id,
        lineNo: index + 1,
        accountId: line.accountId,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      }))
    );

    // 10. Create posting link
    await db.insert(purchasePostingLinks).values({
      tenantId,
      purchaseDocId,
      journalEntryId: journalEntry.id,
      transactionSetId: txSet.id,
    });

    // 11. Update document status to posted if not already
    await db
      .update(purchaseDocs)
      .set({
        status: "posted",
        updatedAt: sql`now()`,
      })
      .where(eq(purchaseDocs.id, purchaseDocId));

    // 12. Create audit event
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "purchase_doc",
      entityId: purchaseDocId,
      action: "purchase_doc_posted",
      metadata: {
        journalEntryId: journalEntry.id,
        transactionSetId: txSet.id,
        docNumber: doc.docNumber,
        totalAmount: docTotal,
        inventoryTotal,
        expenseTotal,
        lineCount: lines.length,
      },
    });

    return {
      success: true,
      purchaseDocId,
      journalEntryId: journalEntry.id,
      transactionSetId: txSet.id,
      idempotent: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      purchaseDocId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: errorMessage,
    };
  }
}
