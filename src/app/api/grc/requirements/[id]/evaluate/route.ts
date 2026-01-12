/**
 * /api/grc/requirements/[id]/evaluate
 *
 * POST: Manually trigger re-evaluation of a requirement
 *
 * Useful for:
 * - Checking if documents have expired
 * - Re-running evaluation after criteria changes
 * - Scheduled compliance checks
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
): { passed: boolean; details: object; atRisk: boolean } {
  const details: Record<string, { required: boolean; satisfied: boolean; value?: unknown; warning?: string }> = {};
  let allPassed = true;
  let atRisk = false;

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

      if (daysUntilExpiry <= 0) {
        // Expired
        details["validity:expiration"] = {
          required: true,
          satisfied: false,
          value: `EXPIRED ${Math.abs(daysUntilExpiry)} days ago`,
        };
        allPassed = false;
      } else if (daysUntilExpiry <= renewalThreshold) {
        // Expiring soon - at risk
        details["validity:expiration"] = {
          required: true,
          satisfied: true,
          value: `${daysUntilExpiry} days until expiry`,
          warning: `Renewal needed within ${renewalThreshold} days`,
        };
        atRisk = true;
      } else {
        details["validity:expiration"] = {
          required: true,
          satisfied: true,
          value: `${daysUntilExpiry} days until expiry (threshold: ${renewalThreshold})`,
        };
      }
    } else {
      details["validity:expiration"] = {
        required: true,
        satisfied: false,
        value: "No expiration date provided",
      };
      allPassed = false;
    }
  }

  return { passed: allPassed, details, atRisk };
}

/**
 * POST /api/grc/requirements/:id/evaluate
 * Manually trigger re-evaluation
 */
export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id: requirementId } = await params;

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

    const evidenceData = (requirement.evidenceData as EvidenceData) || {};
    const closureCriteria = requirement.closureCriteria as ClosureCriteria;

    // Run deterministic closure check
    const { passed, details, atRisk } = checkClosureCriteria(closureCriteria, evidenceData);

    // Determine new status
    const previousStatus = requirement.status;
    let newStatus: "satisfied" | "unsatisfied" | "at_risk" | "unknown";

    if (passed && !atRisk) {
      newStatus = "satisfied";
    } else if (passed && atRisk) {
      newStatus = "at_risk";
    } else if (Object.keys(evidenceData).length === 0) {
      newStatus = "unknown";
    } else {
      newStatus = "unsatisfied";
    }

    const previousRiskLevel = requirement.riskLevel;

    // Update requirement
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (newStatus === "satisfied" && previousStatus !== "satisfied") {
      updateData.satisfiedAt = new Date();
    } else if (newStatus !== "satisfied" && previousStatus === "satisfied") {
      // Was satisfied, now not - clear satisfiedAt
      updateData.satisfiedAt = null;
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
      triggeredBy: "manual_evaluation",
      evidenceSnapshot: evidenceData,
      previousStatus,
      newStatus,
      previousRiskLevel,
      newRiskLevel: requirement.riskLevel,
      closureCheckPassed: passed,
      closureCheckDetails: details,
      aiExplanation: passed
        ? atRisk
          ? "Closure criteria met but approaching expiration. Action needed soon."
          : "All closure criteria have been met. Requirement satisfied."
        : "Some closure criteria are not yet met. See details.",
      aiConfidence: "1.0",
    });

    // Handle status transitions
    if (newStatus === "satisfied" && previousStatus !== "satisfied") {
      // Auto-complete tasks
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

      // Auto-resolve alerts
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
    } else if (newStatus === "at_risk" && previousStatus === "satisfied") {
      // Was satisfied, now at risk - create alert
      await db.insert(grcAlerts).values({
        tenantId,
        requirementId,
        title: `Expiring Soon: ${requirement.title}`,
        message: "This compliance requirement is approaching expiration and needs renewal.",
        alertType: "expiration_warning",
        severity: "warning",
        status: "active",
      });
    } else if (newStatus === "unsatisfied" && previousStatus === "satisfied") {
      // Was satisfied, now not - create alert
      await db.insert(grcAlerts).values({
        tenantId,
        requirementId,
        title: `Action Required: ${requirement.title}`,
        message: "This requirement is no longer satisfied. Immediate action needed.",
        alertType: "requirement_unsatisfied",
        severity: "critical",
        status: "active",
      });

      // Reopen tasks
      await db
        .update(grcTasks)
        .set({
          status: "open",
          completedAt: null,
          autoClosed: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(grcTasks.requirementId, requirementId),
            eq(grcTasks.autoClosed, true)
          )
        );
    }

    return NextResponse.json({
      success: true,
      evaluation: {
        passed,
        atRisk,
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
    console.error("POST /api/grc/requirements/[id]/evaluate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
