/**
 * /api/grc/requirements/[id]/evidence
 *
 * POST: Submit evidence for a requirement (triggers auto-evaluation)
 *
 * This is the core workflow endpoint. When users record an activity
 * (upload document, enter data), this endpoint stores the evidence
 * and triggers deterministic evaluation.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { grcRequirements, grcTasks, grcAlerts, grcRequirementEvaluations } from "@/db/schema";
import { eq, and } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ClosureCriteria {
  required_documents?: string[];
  required_fields?: string[];
  validity_rules?: {
    expiration_check?: boolean;
    renewal_days_before?: number;
  };
}

interface EvidenceData {
  documents?: Array<{ type: string; documentId?: string; filename?: string }>;
  fields?: Record<string, string | number | boolean>;
}

/**
 * Deterministic closure check - evaluates if evidence meets closure criteria
 */
function checkClosureCriteria(
  closureCriteria: ClosureCriteria,
  evidenceData: EvidenceData
): { passed: boolean; details: object } {
  const details: Record<string, { required: boolean; satisfied: boolean; value?: unknown }> = {};
  let allPassed = true;

  // Check required documents
  if (closureCriteria.required_documents && closureCriteria.required_documents.length > 0) {
    const providedDocTypes = (evidenceData.documents || []).map((d) => d.type);

    for (const docType of closureCriteria.required_documents) {
      const satisfied = providedDocTypes.includes(docType);
      details[`document:${docType}`] = {
        required: true,
        satisfied,
        value: satisfied ? "uploaded" : "missing",
      };
      if (!satisfied) allPassed = false;
    }
  }

  // Check required fields
  if (closureCriteria.required_fields && closureCriteria.required_fields.length > 0) {
    const providedFields = evidenceData.fields || {};

    for (const field of closureCriteria.required_fields) {
      const value = providedFields[field];
      const satisfied = value !== undefined && value !== null && value !== "";
      details[`field:${field}`] = {
        required: true,
        satisfied,
        value: value ?? "missing",
      };
      if (!satisfied) allPassed = false;
    }
  }

  // Check validity rules (expiration)
  if (closureCriteria.validity_rules?.expiration_check) {
    const expirationDate = evidenceData.fields?.expiration_date;
    if (expirationDate) {
      const expDate = new Date(expirationDate as string);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const renewalThreshold = closureCriteria.validity_rules.renewal_days_before || 30;

      const satisfied = daysUntilExpiry > renewalThreshold;
      details["validity:expiration"] = {
        required: true,
        satisfied,
        value: `${daysUntilExpiry} days until expiry (threshold: ${renewalThreshold})`,
      };
      if (!satisfied) allPassed = false;
    }
  }

  return { passed: allPassed, details };
}

/**
 * POST /api/grc/requirements/:id/evidence
 * Submit evidence and trigger evaluation
 */
export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id: requirementId } = await params;
    const body = await req.json();

    const { documents, fields } = body as EvidenceData;

    // Get requirement
    const [requirement] = await db
      .select()
      .from(grcRequirements)
      .where(
        and(
          eq(grcRequirements.id, requirementId),
          eq(grcRequirements.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!requirement) {
      return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
    }

    // Merge new evidence with existing
    const existingEvidence = (requirement.evidenceData as EvidenceData) || {};
    const existingDocs = existingEvidence.documents || [];
    const existingFields = existingEvidence.fields || {};

    const mergedEvidence: EvidenceData = {
      documents: [...existingDocs, ...(documents || [])],
      fields: { ...existingFields, ...(fields || {}) },
    };

    // Run deterministic closure check
    const closureCriteria = requirement.closureCriteria as ClosureCriteria;
    const { passed, details } = checkClosureCriteria(closureCriteria, mergedEvidence);

    // Determine new status
    const previousStatus = requirement.status;
    let newStatus = requirement.status;

    if (passed) {
      newStatus = "satisfied";
    } else if (previousStatus === "unknown") {
      newStatus = "unsatisfied";
    }

    // Update requirement with evidence and new status
    const updateData: Record<string, unknown> = {
      evidenceData: mergedEvidence,
      evidenceDocuments: mergedEvidence.documents,
      evidenceUpdatedAt: new Date(),
      status: newStatus,
      updatedAt: new Date(),
    };

    if (passed && previousStatus !== "satisfied") {
      updateData.satisfiedAt = new Date();
    }

    const [updatedRequirement] = await db
      .update(grcRequirements)
      .set(updateData)
      .where(eq(grcRequirements.id, requirementId))
      .returning();

    // Create evaluation record
    await db.insert(grcRequirementEvaluations).values({
      tenantId,
      requirementId,
      triggeredBy: "evidence_submission",
      evidenceSnapshot: mergedEvidence,
      previousStatus,
      newStatus,
      closureCheckPassed: passed,
      closureCheckDetails: details,
      aiExplanation: passed
        ? "All closure criteria have been met. Requirement satisfied."
        : "Some closure criteria are not yet met. See details.",
      aiConfidence: "1.0", // Deterministic, so 100% confidence
    });

    // If requirement is now satisfied, auto-complete related tasks
    if (passed && previousStatus !== "satisfied") {
      await db
        .update(grcTasks)
        .set({
          status: "completed",
          completedAt: new Date(),
          autoClosed: true,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(grcTasks.requirementId, requirementId),
            eq(grcTasks.status, "open")
          )
        );

      // Auto-resolve active alerts
      await db
        .update(grcAlerts)
        .set({
          status: "resolved",
          resolvedAt: new Date(),
          autoResolved: true,
          resolutionReason: "Requirement satisfied - all closure criteria met",
        })
        .where(
          and(
            eq(grcAlerts.requirementId, requirementId),
            eq(grcAlerts.status, "active")
          )
        );
    }

    return NextResponse.json({
      success: true,
      evaluation: {
        passed,
        previousStatus,
        newStatus,
        details,
      },
      requirement: {
        ...updatedRequirement,
        closureCriteria: updatedRequirement.closureCriteria as object,
        evidenceData: updatedRequirement.evidenceData as object,
        evidenceDocuments: updatedRequirement.evidenceDocuments as unknown[],
        evidenceUpdatedAt: updatedRequirement.evidenceUpdatedAt?.toISOString(),
        satisfiedAt: updatedRequirement.satisfiedAt?.toISOString(),
        createdAt: updatedRequirement.createdAt.toISOString(),
        updatedAt: updatedRequirement.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/grc/requirements/[id]/evidence error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
