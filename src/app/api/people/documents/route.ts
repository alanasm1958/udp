/**
 * /api/people/documents
 *
 * HR document management - upload, list, and track employee documents
 * with expiry alerts and verification workflow.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents, documentLinks, employees, people, aiTasks } from "@/db/schema";
import { eq, and, sql, desc, or, lte, gte } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";
import crypto from "crypto";

type DocumentCategory = "id" | "contract" | "certificate" | "visa" | "license" | "policy" | "tax" | "other";
type VerificationStatus = "pending" | "verified" | "rejected" | "expired";

interface CreateDocumentRequest {
  personId?: string;
  employeeId?: string;
  storageKey: string;
  sha256: string;
  mimeType: string;
  originalFilename: string;
  category: DocumentCategory;
  expiryDate?: string; // ISO date
  expiryAlertDays?: number;
  notes?: string;
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * GET /api/people/documents
 * List documents with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const personId = url.searchParams.get("personId");
    const employeeId = url.searchParams.get("employeeId");
    const category = url.searchParams.get("category");
    const status = url.searchParams.get("status");
    const expiringWithinDays = url.searchParams.get("expiringWithinDays");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    // Base conditions
    const conditions = [eq(documents.tenantId, tenantId)];

    // Filter by category
    if (category) {
      conditions.push(eq(documents.category, category as DocumentCategory));
    }

    // Filter by verification status
    if (status) {
      conditions.push(eq(documents.verificationStatus, status as VerificationStatus));
    }

    // Filter by expiring soon
    if (expiringWithinDays) {
      const days = parseInt(expiringWithinDays, 10);
      if (!isNaN(days) && days > 0) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);
        conditions.push(
          and(
            sql`${documents.expiryDate} IS NOT NULL`,
            lte(documents.expiryDate, futureDate.toISOString().split("T")[0]),
            gte(documents.expiryDate, new Date().toISOString().split("T")[0])
          )!
        );
      }
    }

    // Filter by person or employee via documentLinks
    let entityFilter: { type: string; id: string } | null = null;
    if (personId && isValidUuid(personId)) {
      entityFilter = { type: "person", id: personId };
    } else if (employeeId && isValidUuid(employeeId)) {
      entityFilter = { type: "employee", id: employeeId };
    }

    let docs;
    if (entityFilter) {
      docs = await db
        .select({
          id: documents.id,
          storageKey: documents.storageKey,
          originalFilename: documents.originalFilename,
          mimeType: documents.mimeType,
          category: documents.category,
          expiryDate: documents.expiryDate,
          expiryAlertDays: documents.expiryAlertDays,
          verificationStatus: documents.verificationStatus,
          verifiedAt: documents.verifiedAt,
          rejectionReason: documents.rejectionReason,
          notes: documents.notes,
          createdAt: documents.createdAt,
          linkType: documentLinks.linkType,
        })
        .from(documents)
        .innerJoin(documentLinks, eq(documents.id, documentLinks.documentId))
        .where(
          and(
            ...conditions,
            eq(documentLinks.entityType, entityFilter.type),
            eq(documentLinks.entityId, entityFilter.id)
          )
        )
        .orderBy(desc(documents.createdAt))
        .limit(limit);
    } else {
      // Get all HR documents (those with category set)
      conditions.push(sql`${documents.category} IS NOT NULL`);

      docs = await db
        .select({
          id: documents.id,
          storageKey: documents.storageKey,
          originalFilename: documents.originalFilename,
          mimeType: documents.mimeType,
          category: documents.category,
          expiryDate: documents.expiryDate,
          expiryAlertDays: documents.expiryAlertDays,
          verificationStatus: documents.verificationStatus,
          verifiedAt: documents.verifiedAt,
          rejectionReason: documents.rejectionReason,
          notes: documents.notes,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(and(...conditions))
        .orderBy(desc(documents.createdAt))
        .limit(limit);
    }

    // Get linked entity info for each document
    const docsWithLinks = await Promise.all(
      docs.map(async (doc) => {
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
              eq(documentLinks.documentId, doc.id)
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

        return {
          ...doc,
          linkedEntities,
        };
      })
    );

    return NextResponse.json({ items: docsWithLinks });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/people/documents error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/people/documents
 * Upload a new HR document and link to person/employee
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateDocumentRequest = await req.json();

    // Validate required fields
    if (!body.storageKey || !body.sha256 || !body.mimeType || !body.originalFilename || !body.category) {
      return NextResponse.json(
        { error: "storageKey, sha256, mimeType, originalFilename, and category are required" },
        { status: 400 }
      );
    }

    // Validate at least one entity to link
    if (!body.personId && !body.employeeId) {
      return NextResponse.json(
        { error: "Either personId or employeeId is required" },
        { status: 400 }
      );
    }

    // Validate person exists
    let personIdToLink = body.personId;
    if (body.personId && isValidUuid(body.personId)) {
      const [person] = await db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.tenantId, tenantId), eq(people.id, body.personId)));
      if (!person) {
        return NextResponse.json({ error: "Person not found" }, { status: 404 });
      }
    }

    // Validate employee exists and get person ID
    let employeeIdToLink = body.employeeId;
    if (body.employeeId && isValidUuid(body.employeeId)) {
      const [emp] = await db
        .select({ id: employees.id, personId: employees.personId })
        .from(employees)
        .where(and(eq(employees.tenantId, tenantId), eq(employees.id, body.employeeId)));
      if (!emp) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      }
      // If no personId provided, use the employee's personId
      if (!personIdToLink) {
        personIdToLink = emp.personId;
      }
    }

    // Create document
    const [doc] = await db
      .insert(documents)
      .values({
        tenantId,
        storageKey: body.storageKey,
        sha256: body.sha256,
        mimeType: body.mimeType,
        originalFilename: body.originalFilename,
        category: body.category,
        expiryDate: body.expiryDate ?? null,
        expiryAlertDays: body.expiryAlertDays ?? 30,
        verificationStatus: "pending",
        notes: body.notes ?? null,
        uploadedByActorId: actor.actorId,
      })
      .returning();

    // Link to person
    if (personIdToLink) {
      await db.insert(documentLinks).values({
        tenantId,
        documentId: doc.id,
        entityType: "person",
        entityId: personIdToLink,
        linkType: "hr_document",
      });
    }

    // Link to employee
    if (employeeIdToLink) {
      await db.insert(documentLinks).values({
        tenantId,
        documentId: doc.id,
        entityType: "employee",
        entityId: employeeIdToLink,
        linkType: "hr_document",
      });
    }

    await audit.log("document", doc.id, "document_uploaded", {
      category: body.category,
      originalFilename: body.originalFilename,
      personId: personIdToLink,
      employeeId: employeeIdToLink,
    });

    // Create expiry alert AI task if document has expiry date
    if (body.expiryDate) {
      const expiryDate = new Date(body.expiryDate);
      const alertDays = body.expiryAlertDays ?? 30;
      const alertDate = new Date(expiryDate);
      alertDate.setDate(alertDate.getDate() - alertDays);

      // Only create task if alert date is in the future
      if (alertDate > new Date()) {
        const triggerHash = crypto
          .createHash("md5")
          .update(`doc_expiry_${doc.id}`)
          .digest("hex");

        await db.insert(aiTasks).values({
          tenantId,
          taskType: "document_expiry_alert",
          status: "pending",
          title: `Document expiring: ${body.originalFilename}`,
          description: `This document expires on ${body.expiryDate}. Please ensure it is renewed or replaced before expiry.`,
          reasoning: "Document has expiry date set",
          primaryEntityType: "document",
          primaryEntityId: doc.id,
          secondaryEntityType: personIdToLink ? "person" : "employee",
          secondaryEntityId: personIdToLink || employeeIdToLink || null,
          suggestedAction: { action: "renew_document", documentId: doc.id },
          priority: "normal",
          dueAt: alertDate,
          triggerHash,
          createdByActorId: actor.actorId,
        });
      }
    }

    return NextResponse.json({ documentId: doc.id }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/people/documents error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
