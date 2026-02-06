/**
 * Posting Service - Sales Document Posting
 *
 * Posts sales documents (invoices) to the ledger.
 *
 * Creates journal entries:
 * - Dr Accounts Receivable (totalAmount)
 * - Cr Revenue (totalAmount)
 * - If shipped goods with cost: Dr COGS, Cr Inventory
 *
 * THIS MODULE WRITES TO LEDGER TABLES (journal_entries, journal_lines).
 */

import { db } from "@/db";
import {
  transactionSets,
  journalEntries,
  journalLines,
  accounts,
  inventoryMovements,
  products,
  salesDocs,
  salesFulfillments,
  salesPostingLinks,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAuditEvent } from "../audit";
import { checkAndCreatePromotionTask } from "../sales-customers/lead-promotion";

import type {
  SalesDocPostingContext,
  SalesDocPostingResult,
} from "./types";

/**
 * Post a sales document (invoice) to the ledger.
 *
 * Creates journal entries:
 * - Dr Accounts Receivable (totalAmount)
 * - Cr Revenue (totalAmount)
 * - If shipped goods with cost: Dr COGS, Cr Inventory
 *
 * THIS FUNCTION WRITES TO LEDGER TABLES (journal_entries, journal_lines).
 */
export async function postSalesDoc(ctx: SalesDocPostingContext): Promise<SalesDocPostingResult> {
  const { tenantId, actorId, salesDocId, memo } = ctx;

  // 1. Check for existing posting link (idempotency)
  const existingLink = await db
    .select({
      journalEntryId: salesPostingLinks.journalEntryId,
      transactionSetId: salesPostingLinks.transactionSetId,
    })
    .from(salesPostingLinks)
    .where(
      and(
        eq(salesPostingLinks.tenantId, tenantId),
        eq(salesPostingLinks.salesDocId, salesDocId)
      )
    )
    .limit(1);

  if (existingLink.length > 0) {
    return {
      success: true,
      salesDocId,
      journalEntryId: existingLink[0].journalEntryId,
      transactionSetId: existingLink[0].transactionSetId,
      idempotent: true,
    };
  }

  // 2. Fetch sales document
  const [doc] = await db
    .select()
    .from(salesDocs)
    .where(
      and(
        eq(salesDocs.id, salesDocId),
        eq(salesDocs.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!doc) {
    return {
      success: false,
      salesDocId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: "Sales document not found",
    };
  }

  // Only post invoices
  if (doc.docType !== "invoice") {
    return {
      success: false,
      salesDocId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: `Cannot post document type: ${doc.docType}. Only invoices can be posted.`,
    };
  }

  try {
    // 3. Resolve accounts
    const arAccountCode = ctx.arAccountCode || "1100";
    const revenueAccountCode = ctx.revenueAccountCode || "4000";
    const cogsAccountCode = ctx.cogsAccountCode || "5100";
    const inventoryAccountCode = ctx.inventoryAccountCode || "1400";

    const [arAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.code, arAccountCode),
          eq(accounts.isActive, true)
        )
      );

    const [revenueAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.code, revenueAccountCode),
          eq(accounts.isActive, true)
        )
      );

    if (!arAccount || !revenueAccount) {
      return {
        success: false,
        salesDocId,
        journalEntryId: null,
        transactionSetId: null,
        idempotent: false,
        error: `Required accounts not found. AR: ${arAccountCode}, Revenue: ${revenueAccountCode}`,
      };
    }

    const [cogsAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.code, cogsAccountCode),
          eq(accounts.isActive, true)
        )
      );

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

    // 4. Calculate COGS from shipped fulfillments
    let totalCogs = 0;
    const cogsMetadata: Array<{ productId: string; quantity: number; unitCost: number }> = [];

    // Find all "ship" fulfillments for this doc
    const fulfillments = await db
      .select({
        fulfillmentId: salesFulfillments.id,
        salesDocLineId: salesFulfillments.salesDocLineId,
        movementId: salesFulfillments.movementId,
        fulfillmentType: salesFulfillments.fulfillmentType,
        quantity: salesFulfillments.quantity,
      })
      .from(salesFulfillments)
      .where(
        and(
          eq(salesFulfillments.tenantId, tenantId),
          eq(salesFulfillments.salesDocId, salesDocId)
        )
      );

    const shipFulfillments = fulfillments.filter((f) => f.fulfillmentType === "ship");

    for (const fulfillment of shipFulfillments) {
      // Get movement to find cost
      const [movement] = await db
        .select({
          unitCost: inventoryMovements.unitCost,
          productId: inventoryMovements.productId,
        })
        .from(inventoryMovements)
        .where(eq(inventoryMovements.id, fulfillment.movementId))
        .limit(1);

      if (movement) {
        let unitCost = movement.unitCost ? parseFloat(movement.unitCost) : 0;

        // Fallback to product default cost
        if (unitCost === 0) {
          const [product] = await db
            .select({ defaultPurchaseCost: products.defaultPurchaseCost })
            .from(products)
            .where(eq(products.id, movement.productId))
            .limit(1);

          if (product && product.defaultPurchaseCost) {
            unitCost = parseFloat(product.defaultPurchaseCost);
          }
        }

        if (unitCost > 0) {
          const qty = parseFloat(fulfillment.quantity);
          totalCogs += qty * unitCost;
          cogsMetadata.push({
            productId: movement.productId,
            quantity: qty,
            unitCost,
          });
        }
      }
    }

    // 5. Build journal lines
    const docTotal = parseFloat(doc.totalAmount);
    const lines: Array<{
      accountId: string;
      debit: string;
      credit: string;
      description: string | null;
    }> = [];

    // Dr AR
    lines.push({
      accountId: arAccount.id,
      debit: docTotal.toFixed(6),
      credit: "0",
      description: `AR: ${doc.docNumber}`,
    });

    // Cr Revenue
    lines.push({
      accountId: revenueAccount.id,
      debit: "0",
      credit: docTotal.toFixed(6),
      description: `Revenue: ${doc.docNumber}`,
    });

    // COGS entries if we have cost info and accounts
    if (totalCogs > 0 && cogsAccount && inventoryAccount) {
      // Dr COGS
      lines.push({
        accountId: cogsAccount.id,
        debit: totalCogs.toFixed(6),
        credit: "0",
        description: `COGS: ${doc.docNumber}`,
      });

      // Cr Inventory
      lines.push({
        accountId: inventoryAccount.id,
        debit: "0",
        credit: totalCogs.toFixed(6),
        description: `Inventory reduction: ${doc.docNumber}`,
      });
    }

    // 6. Create transaction set
    const [txSet] = await db
      .insert(transactionSets)
      .values({
        tenantId,
        status: "posted",
        source: "sales_posting",
        createdByActorId: actorId,
        businessDate: doc.docDate,
        notes: memo || `Sales posting: ${doc.docNumber}`,
      })
      .returning();

    // 7. Create journal entry - THIS IS THE LEDGER WRITE
    const [journalEntry] = await db
      .insert(journalEntries)
      .values({
        tenantId,
        postingDate: doc.docDate,
        memo: memo || `Sales invoice: ${doc.docNumber}`,
        sourceTransactionSetId: txSet.id,
        postedByActorId: actorId,
      })
      .returning();

    // 8. Create journal lines - THIS IS THE LEDGER WRITE
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

    // 9. Create posting link
    await db.insert(salesPostingLinks).values({
      tenantId,
      salesDocId,
      journalEntryId: journalEntry.id,
      transactionSetId: txSet.id,
    });

    // 10. Update document status to posted if not already
    await db
      .update(salesDocs)
      .set({
        status: "posted",
        updatedAt: sql`now()`,
      })
      .where(eq(salesDocs.id, salesDocId));

    // 11. Create audit event
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "sales_doc",
      entityId: salesDocId,
      action: "sales_doc_posted",
      metadata: {
        journalEntryId: journalEntry.id,
        transactionSetId: txSet.id,
        docNumber: doc.docNumber,
        totalAmount: docTotal,
        totalCogs,
        cogsDetails: cogsMetadata,
        lineCount: lines.length,
      },
    });

    // 12. Check for lead promotion task (async, non-blocking)
    checkAndCreatePromotionTask(tenantId, doc.partyId, actorId).catch((err) => {
      console.error("Lead promotion check failed:", err);
    });

    return {
      success: true,
      salesDocId,
      journalEntryId: journalEntry.id,
      transactionSetId: txSet.id,
      idempotent: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      salesDocId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: errorMessage,
    };
  }
}
