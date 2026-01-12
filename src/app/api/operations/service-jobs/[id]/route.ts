/**
 * /api/operations/service-jobs/[id]
 *
 * Get, update, and manage service job status
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
  aiTasks,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

type ServiceJobStatus = "pending" | "assigned" | "acknowledged" | "in_progress" | "delivered" | "completed" | "cancelled";

const STATUS_TRANSITIONS: Record<ServiceJobStatus, ServiceJobStatus[]> = {
  pending: ["assigned", "cancelled"],
  assigned: ["acknowledged", "in_progress", "cancelled"],
  acknowledged: ["in_progress", "cancelled"],
  in_progress: ["delivered", "cancelled"],
  delivered: ["completed", "in_progress"],
  completed: [],
  cancelled: [],
};

/**
 * GET /api/operations/service-jobs/[id]
 * Get service job details with assignments and events
 */
export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    const [job] = await db
      .select()
      .from(serviceJobs)
      .where(and(eq(serviceJobs.tenantId, tenantId), eq(serviceJobs.id, id)));

    if (!job) {
      return NextResponse.json({ error: "Service job not found" }, { status: 404 });
    }

    // Fetch item details
    const [item] = await db
      .select({ name: items.name, sku: items.sku })
      .from(items)
      .where(eq(items.id, job.itemId));

    // Fetch customer details
    let customerName: string | null = null;
    if (job.customerPartyId) {
      const [customer] = await db
        .select({ name: parties.name })
        .from(parties)
        .where(eq(parties.id, job.customerPartyId));
      customerName = customer?.name ?? null;
    }

    // Fetch customer contact details
    let customerContactName: string | null = null;
    if (job.customerContactPersonId) {
      const [contact] = await db
        .select({ fullName: people.fullName })
        .from(people)
        .where(eq(people.id, job.customerContactPersonId));
      customerContactName = contact?.fullName ?? null;
    }

    // Fetch assignments
    const assignments = await db
      .select({
        id: serviceJobAssignments.id,
        personId: serviceJobAssignments.personId,
        personName: people.fullName,
        personPhone: people.primaryPhone,
        personWhatsapp: people.whatsappNumber,
        isPrimary: serviceJobAssignments.isPrimary,
        role: serviceJobAssignments.role,
        notifiedAt: serviceJobAssignments.notifiedAt,
        notificationStatus: serviceJobAssignments.notificationStatus,
        acknowledgedAt: serviceJobAssignments.acknowledgedAt,
        isActive: serviceJobAssignments.isActive,
      })
      .from(serviceJobAssignments)
      .innerJoin(people, eq(people.id, serviceJobAssignments.personId))
      .where(
        and(
          eq(serviceJobAssignments.tenantId, tenantId),
          eq(serviceJobAssignments.serviceJobId, id)
        )
      );

    // Fetch events
    const events = await db
      .select({
        id: serviceJobEvents.id,
        eventType: serviceJobEvents.eventType,
        fromStatus: serviceJobEvents.fromStatus,
        toStatus: serviceJobEvents.toStatus,
        personId: serviceJobEvents.personId,
        notes: serviceJobEvents.notes,
        occurredAt: serviceJobEvents.occurredAt,
      })
      .from(serviceJobEvents)
      .where(
        and(
          eq(serviceJobEvents.tenantId, tenantId),
          eq(serviceJobEvents.serviceJobId, id)
        )
      )
      .orderBy(serviceJobEvents.occurredAt);

    return NextResponse.json({
      ...job,
      itemName: item?.name,
      itemSku: item?.sku,
      customerName,
      customerContactName,
      assignments,
      events,
      allowedTransitions: STATUS_TRANSITIONS[job.status as ServiceJobStatus] || [],
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/operations/service-jobs/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/operations/service-jobs/[id]
 * Update service job (status transitions, assignments, details)
 */
export async function PUT(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const [existing] = await db
      .select()
      .from(serviceJobs)
      .where(and(eq(serviceJobs.tenantId, tenantId), eq(serviceJobs.id, id)));

    if (!existing) {
      return NextResponse.json({ error: "Service job not found" }, { status: 404 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    // Handle status transition
    if (body.status && body.status !== existing.status) {
      const currentStatus = existing.status as ServiceJobStatus;
      const newStatus = body.status as ServiceJobStatus;
      const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];

      if (!allowedTransitions.includes(newStatus)) {
        return NextResponse.json(
          { error: `Cannot transition from '${currentStatus}' to '${newStatus}'` },
          { status: 400 }
        );
      }

      updateData.status = newStatus;

      // Record status change event
      await db.insert(serviceJobEvents).values({
        tenantId,
        serviceJobId: id,
        eventType: "status_changed",
        fromStatus: currentStatus,
        toStatus: newStatus,
        notes: body.statusNotes ?? null,
        actorId: actor.actorId,
      });

      // Handle completion
      if (newStatus === "completed") {
        updateData.completedAt = new Date();
        updateData.completionNotes = body.completionNotes ?? null;
      }
    }

    // Update other fields
    if (body.description !== undefined) updateData.description = body.description;
    if (body.scheduledDate !== undefined) updateData.scheduledDate = body.scheduledDate;
    if (body.scheduledTime !== undefined) updateData.scheduledTime = body.scheduledTime;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate;
    if (body.completionNotes !== undefined) updateData.completionNotes = body.completionNotes;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    // Handle adding assignees
    if (body.addAssignee) {
      const { personId, isPrimary, role } = body.addAssignee;
      if (!isValidUuid(personId)) {
        return NextResponse.json({ error: "Invalid personId format" }, { status: 400 });
      }

      const [person] = await db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.tenantId, tenantId), eq(people.id, personId)));

      if (!person) {
        return NextResponse.json({ error: "Person not found" }, { status: 404 });
      }

      // Check if already assigned
      const [existingAssignment] = await db
        .select({ id: serviceJobAssignments.id })
        .from(serviceJobAssignments)
        .where(
          and(
            eq(serviceJobAssignments.tenantId, tenantId),
            eq(serviceJobAssignments.serviceJobId, id),
            eq(serviceJobAssignments.personId, personId)
          )
        );

      if (!existingAssignment) {
        await db.insert(serviceJobAssignments).values({
          tenantId,
          serviceJobId: id,
          personId,
          isPrimary: isPrimary ?? false,
          role: role ?? null,
          createdByActorId: actor.actorId,
        });

        await db.insert(serviceJobEvents).values({
          tenantId,
          serviceJobId: id,
          eventType: "assigned",
          personId,
          actorId: actor.actorId,
        });

        // Update status to assigned if currently pending
        if (existing.status === "pending") {
          updateData.status = "assigned";
        }
      }
    }

    // Handle acknowledgement
    if (body.acknowledge && body.personId) {
      const personId = body.personId;
      if (!isValidUuid(personId)) {
        return NextResponse.json({ error: "Invalid personId format" }, { status: 400 });
      }

      await db
        .update(serviceJobAssignments)
        .set({ acknowledgedAt: new Date() })
        .where(
          and(
            eq(serviceJobAssignments.tenantId, tenantId),
            eq(serviceJobAssignments.serviceJobId, id),
            eq(serviceJobAssignments.personId, personId)
          )
        );

      await db.insert(serviceJobEvents).values({
        tenantId,
        serviceJobId: id,
        eventType: "acknowledged",
        personId,
        actorId: actor.actorId,
      });

      // Update status if not already beyond acknowledged
      if (existing.status === "assigned") {
        updateData.status = "acknowledged";
      }
    }

    const [updated] = await db
      .update(serviceJobs)
      .set(updateData)
      .where(and(eq(serviceJobs.tenantId, tenantId), eq(serviceJobs.id, id)))
      .returning();

    await audit.log("service_job", id, "service_job_updated", {
      changes: Object.keys(updateData),
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PUT /api/operations/service-jobs/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
