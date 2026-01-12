/**
 * /api/grc/requirements
 *
 * GET: List GRC requirements with filters
 * POST: Create a new requirement (usually done by AI analysis)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { grcRequirements } from "@/db/schema";
import { eq, and, sql, desc, or, ilike } from "drizzle-orm";

export interface GrcRequirementResponse {
  id: string;
  requirementCode: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  riskLevel: string;
  priority: number | null;
  closureCriteria: object;
  evidenceDocuments: unknown[];
  evidenceData: object | null;
  evidenceUpdatedAt: string | null;
  aiExplanation: string | null;
  aiConfidence: string | null;
  satisfiedAt: string | null;
  expiresAt: string | null;
  nextActionDue: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/grc/requirements
 * List requirements with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const riskLevel = searchParams.get("riskLevel");
    const search = searchParams.get("q");
    const activeOnly = searchParams.get("activeOnly") !== "false";
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build conditions
    const conditions = [eq(grcRequirements.tenantId, tenantId)];

    if (activeOnly) {
      conditions.push(eq(grcRequirements.isActive, true));
    }

    if (status) {
      conditions.push(eq(grcRequirements.status, status as "satisfied" | "unsatisfied" | "at_risk" | "unknown"));
    }

    if (category) {
      conditions.push(eq(grcRequirements.category, category as "tax" | "labor" | "licensing" | "environmental" | "data_privacy" | "financial" | "health_safety" | "insurance" | "corporate_governance"));
    }

    if (riskLevel) {
      conditions.push(eq(grcRequirements.riskLevel, riskLevel as "low" | "medium" | "high" | "critical"));
    }

    if (search) {
      conditions.push(
        or(
          ilike(grcRequirements.title, `%${search}%`),
          ilike(grcRequirements.requirementCode, `%${search}%`),
          ilike(grcRequirements.description, `%${search}%`)
        )!
      );
    }

    // Query requirements
    const requirementsData = await db
      .select()
      .from(grcRequirements)
      .where(and(...conditions))
      .orderBy(desc(grcRequirements.riskLevel), desc(grcRequirements.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(grcRequirements)
      .where(and(...conditions));

    const total = countResult[0]?.count || 0;

    const requirements: GrcRequirementResponse[] = requirementsData.map((r) => ({
      id: r.id,
      requirementCode: r.requirementCode,
      title: r.title,
      description: r.description,
      category: r.category,
      status: r.status,
      riskLevel: r.riskLevel,
      priority: r.priority,
      closureCriteria: r.closureCriteria as object,
      evidenceDocuments: (r.evidenceDocuments as unknown[]) || [],
      evidenceData: r.evidenceData as object | null,
      evidenceUpdatedAt: r.evidenceUpdatedAt?.toISOString() || null,
      aiExplanation: r.aiExplanation,
      aiConfidence: r.aiConfidence,
      satisfiedAt: r.satisfiedAt?.toISOString() || null,
      expiresAt: r.expiresAt?.toISOString() || null,
      nextActionDue: r.nextActionDue || null,
      isActive: r.isActive ?? true,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    // Calculate summary stats
    const stats = {
      total,
      satisfied: requirementsData.filter((r) => r.status === "satisfied").length,
      unsatisfied: requirementsData.filter((r) => r.status === "unsatisfied").length,
      atRisk: requirementsData.filter((r) => r.status === "at_risk").length,
      critical: requirementsData.filter((r) => r.riskLevel === "critical").length,
      high: requirementsData.filter((r) => r.riskLevel === "high").length,
    };

    return NextResponse.json({ requirements, total, stats });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/grc/requirements error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/grc/requirements
 * Create a new requirement manually
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const body = await req.json();

    const {
      requirementCode,
      title,
      description,
      category,
      riskLevel,
      priority,
      closureCriteria,
      aiExplanation,
    } = body;

    if (!requirementCode || !title || !category || !closureCriteria) {
      return NextResponse.json(
        { error: "requirementCode, title, category, and closureCriteria are required" },
        { status: 400 }
      );
    }

    // Check for duplicate code
    const existing = await db
      .select({ id: grcRequirements.id })
      .from(grcRequirements)
      .where(
        and(
          eq(grcRequirements.tenantId, tenantId),
          eq(grcRequirements.requirementCode, requirementCode)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Requirement with code ${requirementCode} already exists` },
        { status: 409 }
      );
    }

    // Create requirement
    const [requirement] = await db
      .insert(grcRequirements)
      .values({
        tenantId,
        requirementCode,
        title,
        description: description || null,
        category,
        riskLevel: riskLevel || "medium",
        priority: priority || 5,
        closureCriteria,
        status: "unsatisfied",
        aiExplanation: aiExplanation || null,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ requirement }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/grc/requirements error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
