/**
 * /api/operations/service-jobs
 *
 * CRUD endpoints for Service Jobs.
 * Service jobs are created when service items are sold.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  serviceJobs,
  serviceJobAssignments,
  serviceJobEvents,
  items,
  people,
  parties,
  salesDocs,
  salesDocLines,
  serviceProviders,
  aiTasks,
} from "@/db/schema";
import { eq, and, ilike, or, sql, inArray, desc } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateServiceJobRequest {
  itemId: string;
  salesDocId?: string;
  salesDocLineId?: string;
  customerPartyId?: string;
  customerContactPersonId?: string;
  description?: string;
  quantity?: string | number;
  scheduledDate?: string;
  scheduledTime?: string;
  dueDate?: string;
  assignees?: Array<{
    personId: string;
    isPrimary?: boolean;
    role?: string;
  }>;
  metadata?: Record<string, unknown>;
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function generateJobNumber(): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SJ${y}${m}${d}-${rand}`;
}

/**
 * GET /api/operations/service-jobs
 * List service jobs with filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const statusFilter = url.searchParams.get("status");
    const itemId = url.searchParams.get("itemId");
    const customerPartyId = url.searchParams.get("customerPartyId");
    const assigneePersonId = url.searchParams.get("assigneePersonId");
    const searchQuery = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(serviceJobs.tenantId, tenantId)];

    if (statusFilter) {
      const validStatuses = ["pending", "assigned", "acknowledged", "in_progress", "delivered", "completed", "cancelled"];
      if (validStatuses.includes(statusFilter)) {
        conditions.push(eq(serviceJobs.status, statusFilter as typeof serviceJobs.status.enumValues[number]));
      }
    }

    if (itemId && isValidUuid(itemId)) {
      conditions.push(eq(serviceJobs.itemId, itemId));
    }

    if (customerPartyId && isValidUuid(customerPartyId)) {
      conditions.push(eq(serviceJobs.customerPartyId, customerPartyId));
    }

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      conditions.push(
        or(
          ilike(serviceJobs.jobNumber, searchPattern),
          ilike(serviceJobs.description, searchPattern)
        )!
      );
    }

    // Build the query
    const jobsQuery = db
      .select({
        id: serviceJobs.id,
        jobNumber: serviceJobs.jobNumber,
        itemId: serviceJobs.itemId,
        itemName: items.name,
        customerPartyId: serviceJobs.customerPartyId,
        customerName: parties.name,
        status: serviceJobs.status,
        quantity: serviceJobs.quantity,
        scheduledDate: serviceJobs.scheduledDate,
        dueDate: serviceJobs.dueDate,
        createdAt: serviceJobs.createdAt,
      })
      .from(serviceJobs)
      .innerJoin(items, eq(items.id, serviceJobs.itemId))
      .leftJoin(parties, eq(parties.id, serviceJobs.customerPartyId))
      .where(and(...conditions))
      .orderBy(desc(serviceJobs.createdAt))
      .limit(limit);

    const jobsList = await jobsQuery;

    // If filtering by assignee, we need to join with assignments
    if (assigneePersonId && isValidUuid(assigneePersonId)) {
      const assignedJobIds = await db
        .select({ jobId: serviceJobAssignments.serviceJobId })
        .from(serviceJobAssignments)
        .where(
          and(
            eq(serviceJobAssignments.tenantId, tenantId),
            eq(serviceJobAssignments.personId, assigneePersonId),
            eq(serviceJobAssignments.isActive, true)
          )
        );

      const filteredJobs = jobsList.filter((job) =>
        assignedJobIds.some((a) => a.jobId === job.id)
      );
      return NextResponse.json({ jobs: filteredJobs });
    }

    return NextResponse.json({ jobs: jobsList });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/operations/service-jobs error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/operations/service-jobs
 * Create a new service job
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateServiceJobRequest = await req.json();

    // Validate required fields
    if (!body.itemId) {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 });
    }

    if (!isValidUuid(body.itemId)) {
      return NextResponse.json({ error: "Invalid itemId format" }, { status: 400 });
    }

    // Validate item is a service
    const [item] = await db
      .select({ id: items.id, type: items.type, name: items.name })
      .from(items)
      .where(and(eq(items.tenantId, tenantId), eq(items.id, body.itemId)));

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.type !== "service") {
      return NextResponse.json({ error: "Item must be of type 'service'" }, { status: 400 });
    }

    // Validate customer if provided
    if (body.customerPartyId) {
      if (!isValidUuid(body.customerPartyId)) {
        return NextResponse.json({ error: "Invalid customerPartyId format" }, { status: 400 });
      }
      const [customer] = await db
        .select({ id: parties.id })
        .from(parties)
        .where(and(eq(parties.tenantId, tenantId), eq(parties.id, body.customerPartyId)));
      if (!customer) {
        return NextResponse.json({ error: "Customer party not found" }, { status: 404 });
      }
    }

    // Validate customer contact if provided
    if (body.customerContactPersonId) {
      if (!isValidUuid(body.customerContactPersonId)) {
        return NextResponse.json({ error: "Invalid customerContactPersonId format" }, { status: 400 });
      }
      const [contact] = await db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.tenantId, tenantId), eq(people.id, body.customerContactPersonId)));
      if (!contact) {
        return NextResponse.json({ error: "Customer contact person not found" }, { status: 404 });
      }
    }

    // Validate sales doc if provided
    if (body.salesDocId) {
      if (!isValidUuid(body.salesDocId)) {
        return NextResponse.json({ error: "Invalid salesDocId format" }, { status: 400 });
      }
      const [salesDoc] = await db
        .select({ id: salesDocs.id })
        .from(salesDocs)
        .where(and(eq(salesDocs.tenantId, tenantId), eq(salesDocs.id, body.salesDocId)));
      if (!salesDoc) {
        return NextResponse.json({ error: "Sales document not found" }, { status: 404 });
      }
    }

    const jobNumber = generateJobNumber();
    const hasAssignees = body.assignees && body.assignees.length > 0;

    // Create service job
    const [job] = await db
      .insert(serviceJobs)
      .values({
        tenantId,
        itemId: body.itemId,
        salesDocId: body.salesDocId ?? null,
        salesDocLineId: body.salesDocLineId ?? null,
        customerPartyId: body.customerPartyId ?? null,
        customerContactPersonId: body.customerContactPersonId ?? null,
        jobNumber,
        description: body.description ?? item.name,
        quantity: body.quantity ? String(body.quantity) : "1",
        status: hasAssignees ? "assigned" : "pending",
        scheduledDate: body.scheduledDate ?? null,
        scheduledTime: body.scheduledTime ?? null,
        dueDate: body.dueDate ?? null,
        metadata: body.metadata ?? {},
        createdByActorId: actor.actorId,
      })
      .returning();

    // Create initial event
    await db.insert(serviceJobEvents).values({
      tenantId,
      serviceJobId: job.id,
      eventType: "created",
      toStatus: hasAssignees ? "assigned" : "pending",
      actorId: actor.actorId,
    });

    await audit.log("service_job", job.id, "service_job_created", {
      jobNumber,
      itemId: body.itemId,
      customerPartyId: body.customerPartyId,
    });

    // Create assignments if provided
    if (hasAssignees) {
      for (const assignee of body.assignees!) {
        if (!isValidUuid(assignee.personId)) continue;

        const [person] = await db
          .select({ id: people.id })
          .from(people)
          .where(and(eq(people.tenantId, tenantId), eq(people.id, assignee.personId)));

        if (person) {
          await db.insert(serviceJobAssignments).values({
            tenantId,
            serviceJobId: job.id,
            personId: assignee.personId,
            isPrimary: assignee.isPrimary ?? (body.assignees!.indexOf(assignee) === 0),
            role: assignee.role ?? null,
            createdByActorId: actor.actorId,
          });

          await db.insert(serviceJobEvents).values({
            tenantId,
            serviceJobId: job.id,
            eventType: "assigned",
            personId: assignee.personId,
            actorId: actor.actorId,
          });
        }
      }
    } else {
      // Create AI task for unassigned job
      await db.insert(aiTasks).values({
        tenantId,
        taskType: "service_job_unassigned",
        status: "pending",
        title: `Assign provider for job ${jobNumber}`,
        description: `Service job for "${item.name}" needs a provider assigned.`,
        reasoning: "Service jobs require assignment to be fulfilled.",
        primaryEntityType: "service_job",
        primaryEntityId: job.id,
        suggestedAction: { action: "assign_provider", jobId: job.id },
        priority: "high",
        createdByActorId: actor.actorId,
      });
    }

    return NextResponse.json({ jobId: job.id, jobNumber }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/operations/service-jobs error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
