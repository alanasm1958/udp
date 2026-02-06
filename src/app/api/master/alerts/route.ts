import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { masterAlerts } from "@/db/schema";
import { eq, and, desc, sql, inArray, or, ilike } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/master/alerts
 * Unified endpoint for all alerts across modules
 *
 * Query params:
 * - status: active|acknowledged|resolved|dismissed|all (default: active)
 * - category: standard|compliance|all (default: all)
 * - domain: operations|hr|finance|sales|all (default: all)
 * - severity: info|warning|critical|all (default: all)
 * - source: system|ai|connector|user|all (default: all)
 * - search: text search in title/message
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * - sortBy: severity|createdAt (default: severity)
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") || "active";
    const category = searchParams.get("category") || "all";
    const domain = searchParams.get("domain") || "all";
    const severity = searchParams.get("severity") || "all";
    const source = searchParams.get("source") || "all";
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const sortBy = searchParams.get("sortBy") || "severity";

    // Build where conditions
    const conditions = [eq(masterAlerts.tenantId, tenantId)];

    if (status !== "all") {
      conditions.push(eq(masterAlerts.status, status as typeof masterAlerts.status.enumValues[number]));
    }

    if (category !== "all") {
      conditions.push(eq(masterAlerts.category, category as typeof masterAlerts.category.enumValues[number]));
    }

    if (domain !== "all") {
      conditions.push(eq(masterAlerts.domain, domain));
    }

    if (severity !== "all") {
      conditions.push(eq(masterAlerts.severity, severity as typeof masterAlerts.severity.enumValues[number]));
    }

    if (source !== "all") {
      conditions.push(eq(masterAlerts.source, source as typeof masterAlerts.source.enumValues[number]));
    }

    if (search) {
      conditions.push(
        or(
          ilike(masterAlerts.title, `%${search}%`),
          ilike(masterAlerts.message, `%${search}%`)
        )!
      );
    }

    // Severity order for sorting
    const severityOrder = sql`CASE
      WHEN ${masterAlerts.severity} = 'critical' THEN 1
      WHEN ${masterAlerts.severity} = 'warning' THEN 2
      WHEN ${masterAlerts.severity} = 'info' THEN 3
      ELSE 4
    END`;

    // Determine sort order
    let orderBy;
    switch (sortBy) {
      case "createdAt":
        orderBy = [desc(masterAlerts.createdAt)];
        break;
      case "severity":
      default:
        orderBy = [severityOrder, desc(masterAlerts.createdAt)];
    }

    // Fetch alerts
    const alertResults = await db
      .select({
        id: masterAlerts.id,
        category: masterAlerts.category,
        domain: masterAlerts.domain,
        alertType: masterAlerts.alertType,
        title: masterAlerts.title,
        message: masterAlerts.message,
        severity: masterAlerts.severity,
        status: masterAlerts.status,
        source: masterAlerts.source,
        relatedEntityType: masterAlerts.relatedEntityType,
        relatedEntityId: masterAlerts.relatedEntityId,
        requirementId: masterAlerts.requirementId,
        resolvedAt: masterAlerts.resolvedAt,
        autoResolved: masterAlerts.autoResolved,
        resolutionReason: masterAlerts.resolutionReason,
        expiresAt: masterAlerts.expiresAt,
        metadata: masterAlerts.metadata,
        createdAt: masterAlerts.createdAt,
      })
      .from(masterAlerts)
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(masterAlerts)
      .where(and(...conditions));

    const totalCount = Number(countResult[0]?.count || 0);

    // Get summary counts by severity and status
    const severityCounts = await db
      .select({
        severity: masterAlerts.severity,
        count: sql<number>`count(*)`,
      })
      .from(masterAlerts)
      .where(
        and(
          eq(masterAlerts.tenantId, tenantId),
          eq(masterAlerts.status, "active")
        )
      )
      .groupBy(masterAlerts.severity);

    const statusCounts = await db
      .select({
        status: masterAlerts.status,
        count: sql<number>`count(*)`,
      })
      .from(masterAlerts)
      .where(eq(masterAlerts.tenantId, tenantId))
      .groupBy(masterAlerts.status);

    const summary = {
      total: totalCount,
      bySeverity: Object.fromEntries(
        severityCounts.map((s) => [s.severity, Number(s.count)])
      ),
      byStatus: Object.fromEntries(
        statusCounts.map((s) => [s.status, Number(s.count)])
      ),
    };

    return NextResponse.json({
      alerts: alertResults.map((a) => ({
        ...a,
        resolvedAt: a.resolvedAt?.toISOString() || null,
        expiresAt: a.expiresAt?.toISOString() || null,
        createdAt: a.createdAt.toISOString(),
      })),
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + alertResults.length < totalCount,
      },
      summary,
    });
  } catch (error) {
    console.error("Master alerts GET error:", error);
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/master/alerts
 * Create a new alert
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const body = await request.json();

    const {
      category,
      domain,
      alertType,
      title,
      message,
      severity,
      source = "system",
      relatedEntityType,
      relatedEntityId,
      requirementId,
      expiresAt,
      metadata,
    } = body;

    // Validate required fields
    if (!category || !domain || !alertType || !title || !severity) {
      return NextResponse.json(
        { error: "category, domain, alertType, title, and severity are required" },
        { status: 400 }
      );
    }

    const [newAlert] = await db
      .insert(masterAlerts)
      .values({
        tenantId,
        category,
        domain,
        alertType,
        title,
        message,
        severity,
        source,
        relatedEntityType,
        relatedEntityId,
        requirementId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        metadata: metadata || {},
      })
      .returning();

    return NextResponse.json({ alert: newAlert }, { status: 201 });
  } catch (error) {
    console.error("Master alerts POST error:", error);
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to create alert" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/master/alerts
 * Update alert status (bulk update by IDs)
 */
export async function PATCH(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const body = await request.json();

    const { ids, updates } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids array is required" },
        { status: 400 }
      );
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "updates object is required" },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};

    const allowedFields = [
      "status",
      "resolvedAt",
      "autoResolved",
      "resolutionReason",
      "metadata",
    ];

    for (const field of allowedFields) {
      if (field in updates) {
        if (field === "resolvedAt") {
          updateData[field] = updates[field] ? new Date(updates[field]) : null;
        } else {
          updateData[field] = updates[field];
        }
      }
    }

    // If resolving, set resolvedAt if not provided
    if (updates.status === "resolved" && !updateData.resolvedAt) {
      updateData.resolvedAt = new Date();
    }

    const updated = await db
      .update(masterAlerts)
      .set(updateData)
      .where(
        and(
          eq(masterAlerts.tenantId, tenantId),
          inArray(masterAlerts.id, ids)
        )
      )
      .returning({ id: masterAlerts.id });

    return NextResponse.json({
      updated: updated.length,
      ids: updated.map((a) => a.id),
    });
  } catch (error) {
    console.error("Master alerts PATCH error:", error);
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to update alerts" },
      { status: 500 }
    );
  }
}
