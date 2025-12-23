/**
 * POST /api/omni/draft
 *
 * THE SINGLE FINANCIAL WRITE PATH for creating draft financial data.
 * All financial drafts must go through this endpoint.
 *
 * Creates:
 * - transaction_sets (draft)
 * - business_transactions
 * - business_transaction_lines
 * - documents (if provided)
 * - document_extractions (if provided)
 * - document_links (linking document to transaction_set)
 * - posting_intents (if provided)
 * - validation_issues (based on validation rules)
 * - approvals (if escalation required)
 * - audit_events (for all actions)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  transactionSets,
  businessTransactions,
  businessTransactionLines,
  documents,
  documentExtractions,
  documentLinks,
  postingIntents,
} from "@/db/schema";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";
import { validateDraft, checkEscalation, CreatedValidationIssue } from "@/lib/validation";

// Request types
interface LineInput {
  description: string;
  quantity?: string | number;
  unitPrice?: string | number;
  amount?: string | number;
  metadata?: Record<string, unknown>;
}

interface TransactionInput {
  type: string;
  occurredOn?: string;
  memo?: string;
  lines?: LineInput[];
}

interface ExtractionInput {
  model?: string;
  confidence?: number;
  extracted?: Record<string, unknown>;
}

interface DocumentInput {
  storageKey: string;
  sha256: string;
  mimeType: string;
  originalFilename: string;
  extraction?: ExtractionInput;
}

interface DraftRequestBody {
  businessDate?: string;
  notes?: string;
  transactions?: TransactionInput[];
  document?: DocumentInput;
  postingIntent?: Record<string, unknown>;
}

// Response types
interface DraftResponse {
  transactionSetId: string;
  created: {
    businessTransactionIds: string[];
    documentId: string | null;
    documentExtractionId: string | null;
    postingIntentId: string | null;
    approvalId: string | null;
  };
  validationIssues: CreatedValidationIssue[];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Extract and validate tenant ID from headers (NEVER from body)
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    // 2. Resolve actor
    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    // 3. Parse request body
    const body: DraftRequestBody = await req.json();
    const transactions = body.transactions ?? [];

    // 4. Create transaction_set (always created, status = draft)
    const [txSet] = await db
      .insert(transactionSets)
      .values({
        tenantId,
        status: "draft",
        source: "web",
        createdByActorId: actor.actorId,
        businessDate: body.businessDate ?? null,
        notes: body.notes ?? null,
      })
      .returning({ id: transactionSets.id });

    await audit.log("transaction_set", txSet.id, "transaction_set_created", {
      businessDate: body.businessDate,
      transactionCount: transactions.length,
    });

    // 5. Create business_transactions and lines
    const businessTransactionIds: string[] = [];

    for (const tx of transactions) {
      const [btx] = await db
        .insert(businessTransactions)
        .values({
          tenantId,
          transactionSetId: txSet.id,
          type: tx.type,
          occurredOn: tx.occurredOn ?? null,
          memo: tx.memo ?? null,
          createdByActorId: actor.actorId,
        })
        .returning({ id: businessTransactions.id });

      businessTransactionIds.push(btx.id);

      await audit.log("business_transaction", btx.id, "business_transaction_created", {
        transactionSetId: txSet.id,
        type: tx.type,
      });

      // Create lines for this transaction
      if (tx.lines && tx.lines.length > 0) {
        await db.insert(businessTransactionLines).values(
          tx.lines.map((line) => ({
            tenantId,
            businessTransactionId: btx.id,
            description: line.description,
            quantity: String(line.quantity ?? "0"),
            unitPrice: String(line.unitPrice ?? "0"),
            amount: String(line.amount ?? "0"),
            metadata: line.metadata ?? {},
          }))
        );
      }
    }

    // 6. Handle document if provided
    let documentId: string | null = null;
    let documentExtractionId: string | null = null;

    if (body.document) {
      const doc = body.document;

      // Create document
      const [docRow] = await db
        .insert(documents)
        .values({
          tenantId,
          storageKey: doc.storageKey,
          sha256: doc.sha256,
          mimeType: doc.mimeType,
          originalFilename: doc.originalFilename,
          uploadedByActorId: actor.actorId,
        })
        .returning({ id: documents.id });

      documentId = docRow.id;

      await audit.log("document", docRow.id, "document_uploaded", {
        originalFilename: doc.originalFilename,
        mimeType: doc.mimeType,
      });

      // Link document to transaction_set
      await db.insert(documentLinks).values({
        tenantId,
        documentId: docRow.id,
        entityType: "transaction_set",
        entityId: txSet.id,
        linkType: "source",
      });

      await audit.log("document", docRow.id, "document_linked", {
        entityType: "transaction_set",
        entityId: txSet.id,
        linkType: "source",
      });

      // Create extraction if provided
      if (doc.extraction) {
        const [extraction] = await db
          .insert(documentExtractions)
          .values({
            tenantId,
            documentId: docRow.id,
            model: doc.extraction.model ?? "unknown",
            confidence: String(doc.extraction.confidence ?? 0),
            extracted: doc.extraction.extracted ?? {},
          })
          .returning({ id: documentExtractions.id });

        documentExtractionId = extraction.id;

        await audit.log("document_extraction", extraction.id, "document_extraction_saved", {
          documentId: docRow.id,
          model: doc.extraction.model,
        });
      }
    }

    // 7. Create posting_intent if provided
    let postingIntentId: string | null = null;

    if (body.postingIntent) {
      const [intent] = await db
        .insert(postingIntents)
        .values({
          tenantId,
          transactionSetId: txSet.id,
          intent: body.postingIntent,
        })
        .returning({ id: postingIntents.id });

      postingIntentId = intent.id;

      await audit.log("posting_intent", intent.id, "posting_intent_saved", {
        transactionSetId: txSet.id,
      });
    }

    // 8. Run validation and create issues
    const validationIssues = await validateDraft({
      tenantId,
      actorId: actor.actorId,
      transactionSetId: txSet.id,
      transactions,
      hasDocument: documentId !== null,
    });

    if (validationIssues.length > 0) {
      await audit.log("transaction_set", txSet.id, "validation_issues_created", {
        issueCount: validationIssues.length,
        issueIds: validationIssues.map((i) => i.id),
        severities: validationIssues.map((i) => i.severity),
      });
    }

    // 9. Check escalation (only if user ID provided)
    const approvalId = await checkEscalation(
      tenantId,
      userIdFromHeader,
      txSet.id,
      validationIssues
    );

    if (approvalId) {
      await audit.log("approval", approvalId, "approval_requested", {
        transactionSetId: txSet.id,
        requiredRole: "Tenant Admin",
        reason: "Error-severity validation issues present",
      });
    }

    // 10. Return response
    const response: DraftResponse = {
      transactionSetId: txSet.id,
      created: {
        businessTransactionIds,
        documentId,
        documentExtractionId,
        postingIntentId,
        approvalId,
      },
      validationIssues,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Omni draft error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
