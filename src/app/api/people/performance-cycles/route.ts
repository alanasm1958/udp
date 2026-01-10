/**
 * /api/people/performance-cycles
 *
 * Manage performance review cycles - quarterly, semi-annual, annual reviews.
 * Cycles define the time period and due dates for performance reviews.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { performanceCycles, performanceReviews, employees, people, aiTasks } from "@/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";
import crypto from "crypto";

type CycleFrequency = "quarterly" | "semi_annual" | "annual" | "custom";
type CycleStatus = "planned" | "active" | "completed" | "cancelled";

interface CreateCycleRequest {
  name: string;
  frequency: CycleFrequency;
  periodStart: string; // ISO date
  periodEnd: string;   // ISO date
  dueDate: string;     // ISO date
  assignedToRole?: "hr" | "manager" | "owner";
  notes?: string;
  autoGenerateReviews?: boolean; // If true, create review records for all active employees
}

interface UpdateCycleRequest {
  name?: string;
  frequency?: CycleFrequency;
  periodStart?: string;
  periodEnd?: string;
  dueDate?: string;
  assignedToRole?: "hr" | "manager" | "owner" | null;
  status?: CycleStatus;
  notes?: string;
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * GET /api/people/performance-cycles
 * List performance cycles with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const statusFilter = url.searchParams.get("status");
    const year = url.searchParams.get("year");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(performanceCycles.tenantId, tenantId)];

    if (statusFilter) {
      conditions.push(eq(performanceCycles.status, statusFilter as CycleStatus));
    }

    if (year) {
      const yearNum = parseInt(year, 10);
      if (!isNaN(yearNum)) {
        conditions.push(
          sql`EXTRACT(YEAR FROM ${performanceCycles.periodStart}) = ${yearNum}`
        );
      }
    }

    const cycles = await db
      .select({
        id: performanceCycles.id,
        name: performanceCycles.name,
        frequency: performanceCycles.frequency,
        periodStart: performanceCycles.periodStart,
        periodEnd: performanceCycles.periodEnd,
        dueDate: performanceCycles.dueDate,
        assignedToRole: performanceCycles.assignedToRole,
        status: performanceCycles.status,
        notes: performanceCycles.notes,
        createdAt: performanceCycles.createdAt,
        reviewCount: sql<number>`(
          SELECT COUNT(*)::int FROM performance_reviews
          WHERE cycle_id = ${performanceCycles.id}
        )`,
        completedReviewCount: sql<number>`(
          SELECT COUNT(*)::int FROM performance_reviews
          WHERE cycle_id = ${performanceCycles.id} AND status IN ('submitted', 'approved')
        )`,
      })
      .from(performanceCycles)
      .where(and(...conditions))
      .orderBy(desc(performanceCycles.periodStart))
      .limit(limit);

    return NextResponse.json({ items: cycles });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/people/performance-cycles error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/people/performance-cycles
 * Create a new performance cycle
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateCycleRequest = await req.json();

    // Validate required fields
    if (!body.name || !body.frequency || !body.periodStart || !body.periodEnd || !body.dueDate) {
      return NextResponse.json(
        { error: "name, frequency, periodStart, periodEnd, and dueDate are required" },
        { status: 400 }
      );
    }

    // Validate dates
    const periodStart = new Date(body.periodStart);
    const periodEnd = new Date(body.periodEnd);
    const dueDate = new Date(body.dueDate);

    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime()) || isNaN(dueDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    if (periodEnd <= periodStart) {
      return NextResponse.json({ error: "periodEnd must be after periodStart" }, { status: 400 });
    }

    // Create cycle
    const [cycle] = await db
      .insert(performanceCycles)
      .values({
        tenantId,
        name: body.name,
        frequency: body.frequency,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        dueDate: body.dueDate,
        assignedToRole: body.assignedToRole ?? null,
        status: "planned",
        notes: body.notes ?? null,
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("performance_cycle", cycle.id, "performance_cycle_created", {
      name: body.name,
      frequency: body.frequency,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
    });

    let reviewsCreated = 0;

    // Auto-generate reviews for all active employees if requested
    if (body.autoGenerateReviews) {
      const activeEmployees = await db
        .select({
          id: employees.id,
          personId: employees.personId,
          managerEmployeeId: employees.managerEmployeeId,
        })
        .from(employees)
        .where(
          and(
            eq(employees.tenantId, tenantId),
            eq(employees.employmentStatus, "active"),
            sql`${employees.terminationDate} IS NULL OR ${employees.terminationDate} > ${body.periodEnd}`
          )
        );

      if (activeEmployees.length > 0) {
        // Find managers for each employee
        const managerMap = new Map<string, string>();
        const managerIds = activeEmployees
          .filter(e => e.managerEmployeeId)
          .map(e => e.managerEmployeeId!);

        if (managerIds.length > 0) {
          const managers = await db
            .select({ id: employees.id })
            .from(employees)
            .where(inArray(employees.id, managerIds));
          managers.forEach(m => managerMap.set(m.id, m.id));
        }

        // Create review records
        const reviewValues = activeEmployees.map(emp => ({
          tenantId,
          cycleId: cycle.id,
          employeeId: emp.id,
          reviewerEmployeeId: emp.managerEmployeeId ?? null,
          status: "not_started" as const,
        }));

        await db.insert(performanceReviews).values(reviewValues);
        reviewsCreated = reviewValues.length;

        // Create AI tasks for reviewers
        for (const emp of activeEmployees) {
          if (emp.managerEmployeeId) {
            const triggerHash = crypto
              .createHash("md5")
              .update(`perf_review_${cycle.id}_${emp.id}`)
              .digest("hex");

            // Get employee name for task
            const [person] = await db
              .select({ fullName: people.fullName })
              .from(people)
              .where(eq(people.id, emp.personId));

            await db.insert(aiTasks).values({
              tenantId,
              taskType: "complete_performance_review",
              status: "pending",
              title: `Complete performance review for ${person?.fullName || "Employee"}`,
              description: `Performance review due for cycle "${body.name}". Due date: ${body.dueDate}`,
              reasoning: "Performance review cycle initiated",
              primaryEntityType: "performance_review",
              primaryEntityId: emp.id,
              secondaryEntityType: "performance_cycle",
              secondaryEntityId: cycle.id,
              suggestedAction: { action: "complete_review", cycleId: cycle.id, employeeId: emp.id },
              priority: "normal",
              dueAt: new Date(body.dueDate),
              triggerHash,
              createdByActorId: actor.actorId,
            });
          }
        }
      }
    }

    return NextResponse.json(
      {
        cycle,
        reviewsCreated,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/people/performance-cycles error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
