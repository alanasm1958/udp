/**
 * Posting Service - Payment Posting
 *
 * Posts payments (receipts and vendor payments) to the ledger.
 * Also handles voiding and unallocating payments.
 *
 * THIS MODULE WRITES TO LEDGER TABLES (journal_entries, journal_lines).
 */

import { db } from "@/db";
import {
  transactionSets,
  journalEntries,
  journalLines,
  accounts,
  reversalLinks,
  payments,
  paymentAllocations,
  paymentPostingLinks,
} from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { logAuditEvent } from "../audit";

import type {
  PaymentPostingContext,
  PaymentPostingResult,
  VoidPaymentInput,
  VoidPaymentResult,
  UnallocatePaymentInput,
  UnallocatePaymentResult,
} from "./types";

/**
 * Post a payment (receipt or vendor payment) to the ledger.
 *
 * Creates journal entries:
 * - Receipt: Dr Cash/Bank, Cr AR
 * - Payment: Dr AP, Cr Cash/Bank
 *
 * THIS FUNCTION WRITES TO LEDGER TABLES (journal_entries, journal_lines).
 */
export async function postPayment(ctx: PaymentPostingContext): Promise<PaymentPostingResult> {
  const { tenantId, actorId, paymentId, memo } = ctx;

  // 1. Check for existing posting link (idempotency)
  const existingLink = await db
    .select({
      journalEntryId: paymentPostingLinks.journalEntryId,
      transactionSetId: paymentPostingLinks.transactionSetId,
    })
    .from(paymentPostingLinks)
    .where(
      and(
        eq(paymentPostingLinks.tenantId, tenantId),
        eq(paymentPostingLinks.paymentId, paymentId)
      )
    )
    .limit(1);

  if (existingLink.length > 0) {
    return {
      success: true,
      paymentId,
      journalEntryId: existingLink[0].journalEntryId,
      transactionSetId: existingLink[0].transactionSetId,
      idempotent: true,
    };
  }

  // 2. Fetch payment
  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.id, paymentId),
        eq(payments.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!payment) {
    return {
      success: false,
      paymentId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: "Payment not found",
    };
  }

  if (payment.status !== "draft") {
    return {
      success: false,
      paymentId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: "Payment must be in draft status to post",
    };
  }

  // 3. Get allocations
  const allocations = await db
    .select()
    .from(paymentAllocations)
    .where(
      and(
        eq(paymentAllocations.tenantId, tenantId),
        eq(paymentAllocations.paymentId, paymentId)
      )
    );

  if (allocations.length === 0) {
    return {
      success: false,
      paymentId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: "Payment must have at least one allocation to post",
    };
  }

  // 4. Calculate total allocated
  const totalAllocated = allocations.reduce(
    (sum, alloc) => sum + parseFloat(alloc.amount),
    0
  );

  if (totalAllocated <= 0) {
    return {
      success: false,
      paymentId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: "Total allocated amount must be greater than zero",
    };
  }

  try {
    // 5. Resolve accounts - use codes stored on the payment record
    const cashBankAccountCode = payment.method === "cash"
      ? payment.cashAccountCode
      : payment.bankAccountCode;
    const arAccountCode = ctx.arAccountCode || "1100";
    const apAccountCode = ctx.apAccountCode || "2000";

    const [cashBankAccount] = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.code, cashBankAccountCode),
          eq(accounts.isActive, true)
        )
      )
      .limit(1);

    if (!cashBankAccount) {
      return {
        success: false,
        paymentId,
        journalEntryId: null,
        transactionSetId: null,
        idempotent: false,
        error: `${payment.method === "cash" ? "Cash" : "Bank"} account not found (${cashBankAccountCode})`,
      };
    }

    // Get AR or AP account based on payment type
    const arApAccountCode = payment.type === "receipt" ? arAccountCode : apAccountCode;
    const [arApAccount] = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.code, arApAccountCode),
          eq(accounts.isActive, true)
        )
      )
      .limit(1);

    if (!arApAccount) {
      return {
        success: false,
        paymentId,
        journalEntryId: null,
        transactionSetId: null,
        idempotent: false,
        error: `${payment.type === "receipt" ? "AR" : "AP"} account not found (${arApAccountCode})`,
      };
    }

    // 6. Build journal lines
    const lines: Array<{
      accountId: string;
      debit: string;
      credit: string;
      description: string | null;
    }> = [];

    if (payment.type === "receipt") {
      // Receipt: Dr Cash/Bank, Cr AR
      lines.push({
        accountId: cashBankAccount.id,
        debit: totalAllocated.toFixed(6),
        credit: "0",
        description: `Receipt: ${payment.reference || paymentId}`,
      });
      lines.push({
        accountId: arApAccount.id,
        debit: "0",
        credit: totalAllocated.toFixed(6),
        description: `AR payment: ${payment.reference || paymentId}`,
      });
    } else {
      // Payment: Dr AP, Cr Cash/Bank
      lines.push({
        accountId: arApAccount.id,
        debit: totalAllocated.toFixed(6),
        credit: "0",
        description: `AP payment: ${payment.reference || paymentId}`,
      });
      lines.push({
        accountId: cashBankAccount.id,
        debit: "0",
        credit: totalAllocated.toFixed(6),
        description: `Payment: ${payment.reference || paymentId}`,
      });
    }

    // 7. Create transaction set
    const [txSet] = await db
      .insert(transactionSets)
      .values({
        tenantId,
        status: "posted",
        source: "payment_posting",
        createdByActorId: actorId,
        businessDate: payment.paymentDate,
        notes: memo || `Payment posting: ${payment.reference || paymentId}`,
      })
      .returning();

    // 8. Create journal entry - THIS IS THE LEDGER WRITE
    const [journalEntry] = await db
      .insert(journalEntries)
      .values({
        tenantId,
        postingDate: payment.paymentDate,
        memo: memo || `${payment.type === "receipt" ? "Customer receipt" : "Vendor payment"}: ${payment.reference || paymentId}`,
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
    await db.insert(paymentPostingLinks).values({
      tenantId,
      paymentId,
      journalEntryId: journalEntry.id,
      transactionSetId: txSet.id,
    });

    // 11. Update payment status to posted
    await db
      .update(payments)
      .set({
        status: "posted",
        updatedAt: sql`now()`,
      })
      .where(eq(payments.id, paymentId));

    // 12. Create audit event
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "payment",
      entityId: paymentId,
      action: "payment_posted",
      metadata: {
        journalEntryId: journalEntry.id,
        transactionSetId: txSet.id,
        totalAllocated,
        allocationCount: allocations.length,
        method: payment.method,
        type: payment.type,
      },
    });

    return {
      success: true,
      paymentId,
      journalEntryId: journalEntry.id,
      transactionSetId: txSet.id,
      idempotent: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      paymentId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: errorMessage,
    };
  }
}

/**
 * Void a payment.
 *
 * For draft payments: simply sets status to void.
 * For posted payments: creates a reversal journal entry and then sets status to void.
 *
 * THIS FUNCTION MAY WRITE TO LEDGER TABLES (journal_entries, journal_lines) for posted payment reversals.
 */
export async function voidPayment(input: VoidPaymentInput): Promise<VoidPaymentResult> {
  const { tenantId, actorId, paymentId, reason } = input;

  return await db.transaction(async (tx) => {
    // 1. Load payment
    const [payment] = await tx
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.id, paymentId),
          eq(payments.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!payment) {
      return {
        success: false,
        paymentId,
        status: "draft" as const,
        idempotent: false,
        error: "Payment not found",
      };
    }

    // 2. Idempotency: if already void, return success
    if (payment.status === "void") {
      return {
        success: true,
        paymentId,
        status: "void" as const,
        idempotent: true,
      };
    }

    // 3. Check for allocations
    const allocations = await tx
      .select({ id: paymentAllocations.id })
      .from(paymentAllocations)
      .where(
        and(
          eq(paymentAllocations.tenantId, tenantId),
          eq(paymentAllocations.paymentId, paymentId)
        )
      )
      .limit(1);

    if (allocations.length > 0) {
      return {
        success: false,
        paymentId,
        status: payment.status as "draft" | "posted",
        idempotent: false,
        error: "Payment has allocations. Unallocate before voiding.",
      };
    }

    // 4. Handle draft payment - just set to void
    if (payment.status === "draft") {
      await tx
        .update(payments)
        .set({
          status: "void",
          updatedAt: sql`now()`,
        })
        .where(eq(payments.id, paymentId));

      await logAuditEvent({
        tenantId,
        actorId,
        entityType: "payment",
        entityId: paymentId,
        action: "payment_voided",
        metadata: {
          previousStatus: "draft",
          reason: reason || "No reason provided",
        },
      });

      return {
        success: true,
        paymentId,
        status: "void" as const,
        idempotent: false,
      };
    }

    // 5. Handle posted payment - create reversal
    if (payment.status === "posted") {
      // Find the posting link to get original journal entry
      const [postingLink] = await tx
        .select({ journalEntryId: paymentPostingLinks.journalEntryId })
        .from(paymentPostingLinks)
        .where(
          and(
            eq(paymentPostingLinks.tenantId, tenantId),
            eq(paymentPostingLinks.paymentId, paymentId)
          )
        )
        .limit(1);

      if (!postingLink || !postingLink.journalEntryId) {
        return {
          success: false,
          paymentId,
          status: "posted" as const,
          idempotent: false,
          error: "Payment is posted but has no posting link (journal entry missing).",
        };
      }

      const originalJournalEntryId = postingLink.journalEntryId;

      // Check if already reversed (idempotency for partial completion)
      const existingReversal = await tx
        .select({ reversalJournalEntryId: reversalLinks.reversalJournalEntryId })
        .from(reversalLinks)
        .where(
          and(
            eq(reversalLinks.tenantId, tenantId),
            eq(reversalLinks.originalJournalEntryId, originalJournalEntryId)
          )
        )
        .limit(1);

      let reversalJournalEntryId: string;

      if (existingReversal.length > 0) {
        // Already reversed, use existing
        reversalJournalEntryId = existingReversal[0].reversalJournalEntryId;
      } else {
        // Create reversal journal entry
        // Fetch original journal lines
        const originalLines = await tx
          .select()
          .from(journalLines)
          .where(
            and(
              eq(journalLines.journalEntryId, originalJournalEntryId),
              eq(journalLines.tenantId, tenantId)
            )
          )
          .orderBy(asc(journalLines.lineNo));

        if (originalLines.length === 0) {
          return {
            success: false,
            paymentId,
            status: "posted" as const,
            idempotent: false,
            error: "Original journal entry has no lines to reverse.",
          };
        }

        // Create transaction set for reversal
        const [reversalTxSet] = await tx
          .insert(transactionSets)
          .values({
            tenantId,
            status: "posted",
            source: "payment_void",
            createdByActorId: actorId,
            businessDate: new Date().toISOString().split("T")[0],
            notes: `Payment void reversal: ${payment.reference || paymentId}`,
          })
          .returning();

        // Create reversal journal entry - THIS IS THE LEDGER WRITE
        const [reversalEntry] = await tx
          .insert(journalEntries)
          .values({
            tenantId,
            postingDate: new Date().toISOString().split("T")[0],
            memo: `Payment void reversal: ${payment.reference || paymentId}${reason ? ` - ${reason}` : ""}`,
            sourceTransactionSetId: reversalTxSet.id,
            postedByActorId: actorId,
          })
          .returning();

        reversalJournalEntryId = reversalEntry.id;

        // Create inverted journal lines - THIS IS THE LEDGER WRITE
        await tx.insert(journalLines).values(
          originalLines.map((line) => ({
            tenantId,
            journalEntryId: reversalEntry.id,
            lineNo: line.lineNo,
            accountId: line.accountId,
            // Invert: debit becomes credit, credit becomes debit
            debit: line.credit,
            credit: line.debit,
            description: line.description ? `Void reversal: ${line.description}` : "Void reversal",
          }))
        );

        // Create reversal link
        await tx.insert(reversalLinks).values({
          tenantId,
          originalJournalEntryId,
          reversalJournalEntryId: reversalEntry.id,
          reason: reason || "Payment voided",
          createdByActorId: actorId,
        });
      }

      // Set payment status to void
      await tx
        .update(payments)
        .set({
          status: "void",
          updatedAt: sql`now()`,
        })
        .where(eq(payments.id, paymentId));

      await logAuditEvent({
        tenantId,
        actorId,
        entityType: "payment",
        entityId: paymentId,
        action: "payment_voided",
        metadata: {
          previousStatus: "posted",
          reason: reason || "No reason provided",
          originalJournalEntryId,
          reversalJournalEntryId,
        },
      });

      return {
        success: true,
        paymentId,
        status: "void" as const,
        idempotent: existingReversal.length > 0,
        originalJournalEntryId,
        reversalJournalEntryId,
      };
    }

    // Unhandled status
    return {
      success: false,
      paymentId,
      status: payment.status as "draft" | "posted",
      idempotent: false,
      error: `Cannot void payment with status: ${payment.status}`,
    };
  });
}

/**
 * Unallocate a payment allocation.
 *
 * Sets the allocation amount to 0 instead of deleting (preserves history, passes guard:nodelete).
 * Only allowed when payment.status is 'draft'.
 */
export async function unallocatePayment(input: UnallocatePaymentInput): Promise<UnallocatePaymentResult> {
  const { tenantId, actorId, paymentId, allocationId, targetType, targetId, reason } = input;

  return await db.transaction(async (tx) => {
    // 1. Load payment
    const [payment] = await tx
      .select({ id: payments.id, status: payments.status })
      .from(payments)
      .where(
        and(
          eq(payments.id, paymentId),
          eq(payments.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!payment) {
      return {
        ok: false,
        paymentId,
        error: "Payment not found",
      };
    }

    // 2. Check payment status - must be draft
    if (payment.status === "posted") {
      return {
        ok: false,
        paymentId,
        error: "Payment is posted. Void the payment and recreate it to change allocations.",
      };
    }

    if (payment.status === "void") {
      return {
        ok: false,
        paymentId,
        error: "Payment is voided. Cannot unallocate.",
      };
    }

    // 3. Find allocation
    let allocation;

    if (allocationId) {
      // Find by allocationId
      const [found] = await tx
        .select()
        .from(paymentAllocations)
        .where(
          and(
            eq(paymentAllocations.id, allocationId),
            eq(paymentAllocations.tenantId, tenantId),
            eq(paymentAllocations.paymentId, paymentId)
          )
        )
        .limit(1);
      allocation = found;
    } else if (targetType && targetId) {
      // Find by targetType + targetId
      const [found] = await tx
        .select()
        .from(paymentAllocations)
        .where(
          and(
            eq(paymentAllocations.tenantId, tenantId),
            eq(paymentAllocations.paymentId, paymentId),
            eq(paymentAllocations.targetType, targetType),
            eq(paymentAllocations.targetId, targetId)
          )
        )
        .limit(1);
      allocation = found;
    } else {
      return {
        ok: false,
        paymentId,
        error: "Must provide either allocationId or (targetType + targetId)",
      };
    }

    // 4. Check if allocation exists
    if (!allocation) {
      return {
        ok: true,
        paymentId,
        idempotent: true,
        message: "Allocation not found or already unallocated",
      };
    }

    // 5. Check if already unallocated (amount is 0)
    const previousAmount = parseFloat(allocation.amount);
    if (previousAmount === 0) {
      return {
        ok: true,
        paymentId,
        allocationId: allocation.id,
        previousAmount: 0,
        idempotent: true,
        message: "Already unallocated",
      };
    }

    // 6. Update allocation amount to 0
    await tx
      .update(paymentAllocations)
      .set({ amount: "0.000000" })
      .where(eq(paymentAllocations.id, allocation.id));

    // 7. Log audit event
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "payment_allocation",
      entityId: allocation.id,
      action: "payment_unallocated",
      metadata: {
        paymentId,
        allocationId: allocation.id,
        targetType: allocation.targetType,
        targetId: allocation.targetId,
        previousAmount,
        reason: reason || "No reason provided",
      },
    });

    return {
      ok: true,
      paymentId,
      allocationId: allocation.id,
      previousAmount,
    };
  });
}
