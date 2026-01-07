/**
 * /api/operations/purchases
 *
 * POST: Record a quick purchase from the Operations Record Activity drawer
 * Creates a purchase document with lines
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseDocs, purchaseDocLines, tasks } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface PurchaseLine {
  itemId?: string;
  freeTextName?: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  warehouseId?: string;
}

interface CreatePurchaseRequest {
  vendorPersonId?: string;
  purchaseDate: string;
  notes?: string;
  lines: PurchaseLine[];
  receivedNow?: boolean;
  paidNow?: boolean;
}

/**
 * POST /api/operations/purchases
 * Record a quick purchase
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreatePurchaseRequest = await req.json();

    if (!body.purchaseDate || !body.lines?.length) {
      return NextResponse.json(
        { error: "purchaseDate and at least one line are required" },
        { status: 400 }
      );
    }

    // Generate a doc number
    const docNumber = `PO-${Date.now().toString(36).toUpperCase()}`;

    // Calculate totals
    let subtotal = 0;
    for (const line of body.lines) {
      if (line.unitCost) {
        subtotal += line.quantity * line.unitCost;
      }
    }

    // Create the purchase document
    const [purchaseDoc] = await db
      .insert(purchaseDocs)
      .values({
        tenantId,
        docType: "order",
        docNumber,
        partyId: body.vendorPersonId || tenantId, // fallback to tenant if no vendor
        docDate: body.purchaseDate,
        subtotal: subtotal.toString(),
        totalAmount: subtotal.toString(),
        status: body.receivedNow ? "fulfilled" : "draft",
        notes: body.notes,
        metadata: {
          source: "operations_drawer",
          receivedNow: body.receivedNow,
          paidNow: body.paidNow,
        },
        createdByActorId: actor.actorId,
      })
      .returning();

    // Create the lines
    let lineNo = 1;
    const taskCreationNeeded: string[] = [];

    for (const line of body.lines) {
      await db.insert(purchaseDocLines).values({
        tenantId,
        purchaseDocId: purchaseDoc.id,
        lineNo,
        productId: line.itemId || null,
        description: line.freeTextName || "Item",
        quantity: line.quantity.toString(),
        unitPrice: (line.unitCost || 0).toString(),
        lineTotal: ((line.quantity || 1) * (line.unitCost || 0)).toString(),
        metadata: {
          unit: line.unit,
          warehouseId: line.warehouseId,
        },
        createdByActorId: actor.actorId,
      });

      // If free-text without item mapping, create a task
      if (!line.itemId && line.freeTextName) {
        taskCreationNeeded.push(line.freeTextName);
      }

      lineNo++;
    }

    // Create tasks for free-text items that need mapping
    for (const freeTextName of taskCreationNeeded) {
      await db.insert(tasks).values({
        tenantId,
        domain: "operations",
        title: `Map purchase item: "${freeTextName}"`,
        description: `The purchase ${docNumber} contains a free-text item "${freeTextName}" that needs to be mapped to a catalog item.`,
        priority: "medium",
        status: "open",
        relatedEntityType: "purchase_doc",
        relatedEntityId: purchaseDoc.id,
        createdByActorId: actor.actorId,
      });
    }

    await audit.log("purchase_doc", purchaseDoc.id, "purchase_doc_created", {
      docNumber,
      linesCount: body.lines.length,
      receivedNow: body.receivedNow,
      paidNow: body.paidNow,
    });

    return NextResponse.json({
      id: purchaseDoc.id,
      docNumber,
      status: purchaseDoc.status,
      taskCreated: taskCreationNeeded.length > 0,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/operations/purchases error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
