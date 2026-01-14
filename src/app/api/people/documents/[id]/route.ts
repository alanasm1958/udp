/**
 * /api/people/documents/[id]
 *
 * Individual document operations - view, verify, reject, delete
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents, documentLinks, employees, people, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

type VerificationStatus = "pending" | "verified" | "rejected" | "expired";

interface UpdateDocumentRequest {
  verificationStatus?: VerificationStatus;
  rejectionReason?: string;
  notes?: string;
  expiryDate?: string;
  expiryAlertDays?: number;
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * GET /api/people/documents/[id]
 * Get single document with all details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });
    }

    const [doc] = await db
      .select({
        id: documents.id,
        storageKey: documents.storageKey,
        sha256: documents.sha256,
        originalFilename: documents.originalFilename,
        mimeType: documents.mimeType,
        category: documents.category,
        expiryDate: documents.expiryDate,
        expiryAlertDays: documents.expiryAlertDays,
        verificationStatus: documents.verificationStatus,
        verifiedByUserId: documents.verifiedByUserId,
        verifiedAt: documents.verifiedAt,
        rejectionReason: documents.rejectionReason,
        notes: documents.notes,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(and(eq(documents.tenantId, tenantId), eq(documents.id, id)));

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Get verifier info
    let verifiedBy = null;
    if (doc.verifiedByUserId) {
      const [user] = await db
        .select({ fullName: users.fullName, email: users.email })
        .from(users)
        .where(eq(users.id, doc.verifiedByUserId));
      verifiedBy = user;
    }

    // Get linked entities
    const links = await db
      .select({
        entityType: documentLinks.entityType,
        entityId: documentLinks.entityId,
        linkType: documentLinks.linkType,
      })
      .from(documentLinks)
      .where(
        and(
          eq(documentLinks.tenantId, tenantId),
          eq(documentLinks.documentId, id)
        )
      );

    // Get person/employee names
    const linkedEntities = await Promise.all(
      links
        .filter((l) => l.entityType === "person" || l.entityType === "employee")
        .map(async (link) => {
          if (link.entityType === "person") {
            const [person] = await db
              .select({ fullName: people.fullName })
              .from(people)
              .where(eq(people.id, link.entityId));
            return { ...link, name: person?.fullName };
          } else if (link.entityType === "employee") {
            const [emp] = await db
              .select({ fullName: people.fullName })
              .from(employees)
              .innerJoin(people, eq(employees.personId, people.id))
              .where(eq(employees.id, link.entityId));
            return { ...link, name: emp?.fullName };
          }
          return link;
        })
    );

    return NextResponse.json({
      ...doc,
      verifiedBy,
      linkedEntities,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/people/documents/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/people/documents/[id]
 * Update document - verification workflow
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    // Verify document exists
    const [existing] = await db
      .select({
        id: documents.id,
        verificationStatus: documents.verificationStatus,
        originalFilename: documents.originalFilename,
      })
      .from(documents)
      .where(and(eq(documents.tenantId, tenantId), eq(documents.id, id)));

    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const body: UpdateDocumentRequest = await req.json();

    // Build update values
    const updateValues: Record<string, unknown> = {};

    if (body.notes !== undefined) {
      updateValues.notes = body.notes;
    }

    if (body.expiryDate !== undefined) {
      updateValues.expiryDate = body.expiryDate;
    }

    if (body.expiryAlertDays !== undefined) {
      updateValues.expiryAlertDays = body.expiryAlertDays;
    }

    // Handle verification status changes
    if (body.verificationStatus && body.verificationStatus !== existing.verificationStatus) {
      updateValues.verificationStatus = body.verificationStatus;

      if (body.verificationStatus === "verified") {
        // Get user ID from actor (if actor is linked to a user)
        updateValues.verifiedByUserId = userIdFromHeader || null;
        updateValues.verifiedAt = new Date();
        updateValues.rejectionReason = null;

        await audit.log("document", id, "document_verified", {
          filename: existing.originalFilename,
          previousStatus: existing.verificationStatus,
        });
      } else if (body.verificationStatus === "rejected") {
        if (!body.rejectionReason) {
          return NextResponse.json(
            { error: "rejectionReason is required when rejecting a document" },
            { status: 400 }
          );
        }
        updateValues.rejectionReason = body.rejectionReason;
        updateValues.verifiedByUserId = userIdFromHeader || null;
        updateValues.verifiedAt = new Date();

        await audit.log("document", id, "document_rejected", {
          filename: existing.originalFilename,
          previousStatus: existing.verificationStatus,
          rejectionReason: body.rejectionReason,
        });
      } else if (body.verificationStatus === "expired") {
        await audit.log("document", id, "document_expired", {
          filename: existing.originalFilename,
          previousStatus: existing.verificationStatus,
        });
      }
    }

    if (Object.keys(updateValues).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const [updated] = await db
      .update(documents)
      .set(updateValues)
      .where(and(eq(documents.tenantId, tenantId), eq(documents.id, id)))
      .returning();

    return NextResponse.json({ document: updated });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/people/documents/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/people/documents/[id]
 * Delete a document and its links
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    // Verify document exists
    const [existing] = await db
      .select({ id: documents.id, originalFilename: documents.originalFilename })
      .from(documents)
      .where(and(eq(documents.tenantId, tenantId), eq(documents.id, id)));

    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Soft delete links first
    await db
      .update(documentLinks)
      .set({ deletedAt: new Date() })
      .where(and(eq(documentLinks.tenantId, tenantId), eq(documentLinks.documentId, id)));

    // Soft delete document
    await db
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(and(eq(documents.tenantId, tenantId), eq(documents.id, id)));

    await audit.log("document", id, "document_uploaded", {
      action: "deleted",
      filename: existing.originalFilename,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/people/documents/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
