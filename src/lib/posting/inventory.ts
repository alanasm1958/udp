/**
 * Posting Service - Inventory Movement Posting
 *
 * Posts inventory movements from a transaction set.
 *
 * This module:
 * 1. Fetches draft movements for the transaction set
 * 2. Updates inventory balances
 * 3. Creates journal entries if cost information is available
 * 4. Marks movements as posted
 * 5. Updates transaction set status
 *
 * THIS MODULE WRITES TO LEDGER TABLES (journal_entries, journal_lines)
 * AND INVENTORY TABLES (inventory_movements, inventory_balances, inventory_posting_links).
 */

import { db } from "@/db";
import {
  transactionSets,
  journalEntries,
  journalLines,
  accounts,
  inventoryMovements,
  inventoryPostingLinks,
  products,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAuditEvent } from "../audit";
import { updateInventoryBalance } from "./core";

import type {
  InventoryPostingContext,
  InventoryPostingResult,
} from "./types";

/**
 * Post inventory movements from a transaction set.
 *
 * This function:
 * 1. Fetches draft movements for the transaction set
 * 2. Updates inventory balances
 * 3. Creates journal entries if cost information is available
 * 4. Marks movements as posted
 * 5. Updates transaction set status
 *
 * THIS FUNCTION WRITES TO LEDGER TABLES (journal_entries, journal_lines)
 * AND INVENTORY TABLES (inventory_movements, inventory_balances, inventory_posting_links).
 */
export async function postInventoryMovements(
  ctx: InventoryPostingContext
): Promise<InventoryPostingResult> {
  const { tenantId, actorId, transactionSetId, memo } = ctx;

  // 1. Check transaction set status for idempotency
  const [txSet] = await db
    .select()
    .from(transactionSets)
    .where(
      and(
        eq(transactionSets.id, transactionSetId),
        eq(transactionSets.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!txSet) {
    return {
      success: false,
      transactionSetId,
      movementIds: [],
      journalEntryId: null,
      status: "failed",
      error: "Transaction set not found",
      idempotent: false,
    };
  }

  // Idempotency: if already posted, return existing result
  if (txSet.status === "posted") {
    const existingMovements = await db
      .select({ id: inventoryMovements.id })
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.tenantId, tenantId),
          eq(inventoryMovements.transactionSetId, transactionSetId),
          eq(inventoryMovements.movementStatus, "posted")
        )
      );

    const existingLinks = await db
      .select({ journalEntryId: inventoryPostingLinks.journalEntryId })
      .from(inventoryPostingLinks)
      .where(
        and(
          eq(inventoryPostingLinks.tenantId, tenantId),
          eq(inventoryPostingLinks.transactionSetId, transactionSetId)
        )
      )
      .limit(1);

    return {
      success: true,
      transactionSetId,
      movementIds: existingMovements.map((m) => m.id),
      journalEntryId: existingLinks[0]?.journalEntryId ?? null,
      status: "posted",
      idempotent: true,
    };
  }

  // 2. Fetch draft movements
  const movements = await db
    .select()
    .from(inventoryMovements)
    .where(
      and(
        eq(inventoryMovements.tenantId, tenantId),
        eq(inventoryMovements.transactionSetId, transactionSetId),
        eq(inventoryMovements.movementStatus, "draft")
      )
    );

  if (movements.length === 0) {
    return {
      success: false,
      transactionSetId,
      movementIds: [],
      journalEntryId: null,
      status: "failed",
      error: "No draft movements found for transaction set",
      idempotent: false,
    };
  }

  try {
    // 3. Process each movement - update balances
    for (const movement of movements) {
      const quantity = parseFloat(movement.quantity);

      // Handle "from" side (decrease balance)
      if (movement.fromWarehouseId) {
        await updateInventoryBalance(
          tenantId,
          movement.productId,
          movement.fromWarehouseId,
          movement.fromLocationId,
          -quantity
        );
      }

      // Handle "to" side (increase balance)
      if (movement.toWarehouseId) {
        await updateInventoryBalance(
          tenantId,
          movement.productId,
          movement.toWarehouseId,
          movement.toLocationId,
          quantity
        );
      }

      // Mark movement as posted
      await db
        .update(inventoryMovements)
        .set({ movementStatus: "posted" })
        .where(eq(inventoryMovements.id, movement.id));

      await logAuditEvent({
        tenantId,
        actorId,
        entityType: "inventory_movement",
        entityId: movement.id,
        action: "inventory_movement_posted",
        metadata: {
          transactionSetId,
          movementType: movement.movementType,
          quantity: movement.quantity,
        },
      });
    }

    // 4. Create journal entry if any movement has unit cost
    let journalEntryId: string | null = null;

    // Also check if product has default_purchase_cost for receipts/adjustments
    const movementsNeedingCost: Array<{
      movement: typeof movements[0];
      cost: number;
    }> = [];

    for (const movement of movements) {
      let cost = movement.unitCost ? parseFloat(movement.unitCost) : 0;

      if (cost === 0 && (movement.movementType === "receipt" || movement.movementType === "adjustment")) {
        // Try to get default cost from product
        const [product] = await db
          .select({ defaultPurchaseCost: products.defaultPurchaseCost })
          .from(products)
          .where(eq(products.id, movement.productId));

        if (product && product.defaultPurchaseCost) {
          cost = parseFloat(product.defaultPurchaseCost);
        }
      }

      if (cost > 0) {
        movementsNeedingCost.push({ movement, cost });
      }
    }

    if (movementsNeedingCost.length > 0) {
      // Find or default inventory asset account and COGS account
      const inventoryAccountCode = ctx.inventoryAssetAccountCode || "1400"; // Default: Inventory
      const cogsAccountCode = ctx.cogsAccountCode || "5100"; // Default: COGS

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

      // Only create journal entry if we have the required accounts
      if (inventoryAccount && cogsAccount) {
        const lines: Array<{
          accountId: string;
          debit: string;
          credit: string;
          description: string | null;
        }> = [];

        for (const { movement, cost } of movementsNeedingCost) {
          const quantity = parseFloat(movement.quantity);
          const totalCost = (quantity * cost).toFixed(6);

          if (movement.movementType === "receipt") {
            // Receipt: Dr Inventory, Cr Clearing (we'll use COGS as placeholder)
            lines.push({
              accountId: inventoryAccount.id,
              debit: totalCost,
              credit: "0",
              description: `Receipt: ${movement.reference || movement.productId}`,
            });
            lines.push({
              accountId: cogsAccount.id,
              debit: "0",
              credit: totalCost,
              description: `Receipt clearing: ${movement.reference || movement.productId}`,
            });
          } else if (movement.movementType === "issue") {
            // Issue: Dr COGS, Cr Inventory
            lines.push({
              accountId: cogsAccount.id,
              debit: totalCost,
              credit: "0",
              description: `Issue: ${movement.reference || movement.productId}`,
            });
            lines.push({
              accountId: inventoryAccount.id,
              debit: "0",
              credit: totalCost,
              description: `Issue: ${movement.reference || movement.productId}`,
            });
          } else if (movement.movementType === "adjustment") {
            // Adjustment: depends on direction
            if (movement.toWarehouseId && !movement.fromWarehouseId) {
              // Positive adjustment
              lines.push({
                accountId: inventoryAccount.id,
                debit: totalCost,
                credit: "0",
                description: `Adjustment (+): ${movement.reference || movement.productId}`,
              });
              lines.push({
                accountId: cogsAccount.id,
                debit: "0",
                credit: totalCost,
                description: `Adjustment clearing: ${movement.reference || movement.productId}`,
              });
            } else if (movement.fromWarehouseId && !movement.toWarehouseId) {
              // Negative adjustment
              lines.push({
                accountId: cogsAccount.id,
                debit: totalCost,
                credit: "0",
                description: `Adjustment (-): ${movement.reference || movement.productId}`,
              });
              lines.push({
                accountId: inventoryAccount.id,
                debit: "0",
                credit: totalCost,
                description: `Adjustment: ${movement.reference || movement.productId}`,
              });
            }
          }
          // Transfer movements don't affect P&L, only location
        }

        if (lines.length > 0) {
          // Create journal entry - THIS IS THE LEDGER WRITE
          const [journalEntry] = await db
            .insert(journalEntries)
            .values({
              tenantId,
              postingDate: movements[0].movementDate,
              memo: memo || `Inventory posting for ${transactionSetId}`,
              sourceTransactionSetId: transactionSetId,
              postedByActorId: actorId,
            })
            .returning();

          journalEntryId = journalEntry.id;

          // Create journal lines - THIS IS THE LEDGER WRITE
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

          // Create posting links
          for (const { movement } of movementsNeedingCost) {
            await db.insert(inventoryPostingLinks).values({
              tenantId,
              transactionSetId,
              journalEntryId: journalEntry.id,
              movementId: movement.id,
            });
          }

          await logAuditEvent({
            tenantId,
            actorId,
            entityType: "journal_entry",
            entityId: journalEntry.id,
            action: "journal_entry_created",
            metadata: {
              source: "inventory_posting",
              transactionSetId,
              lineCount: lines.length,
            },
          });
        }
      }
    }

    // 5. Update transaction set status to posted
    await db
      .update(transactionSets)
      .set({
        status: "posted",
        updatedAt: sql`now()`,
      })
      .where(eq(transactionSets.id, transactionSetId));

    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "transaction_set",
      entityId: transactionSetId,
      action: "transaction_set_posted",
      metadata: {
        source: "inventory",
        movementCount: movements.length,
        journalEntryId,
      },
    });

    return {
      success: true,
      transactionSetId,
      movementIds: movements.map((m) => m.id),
      journalEntryId,
      status: "posted",
      idempotent: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      transactionSetId,
      movementIds: [],
      journalEntryId: null,
      status: "failed",
      error: errorMessage,
      idempotent: false,
    };
  }
}
