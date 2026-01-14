/**
 * /api/sales-customers/activities/[id]
 *
 * Sales Activity Detail endpoints
 * GET: Get activity details
 * PATCH: Update activity
 * DELETE: Delete activity
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesActivities, people, parties, leads, salesDocs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

interface UpdateActivityRequest {
  activityType?: string;
  activityDate?: string;
  outcome?: string | null;
  durationMinutes?: number | null;
  discussionPoints?: string[];
  notes?: string | null;
  internalNotes?: string | null;
  ourCommitments?: Array<{ commitment: string; dueDate: string }>;
  theirCommitments?: Array<{ commitment: string; dueDate: string }>;
  nextAction?: string | null;
  followUpDate?: string | null;
  followUpNote?: string | null;
  attachments?: Array<{ documentId: string; filename: string; url: string }>;
}

/**
 * GET /api/sales-customers/activities/[id]
 * Get activity details with related data
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    const [activity] = await db
      .select({
        id: salesActivities.id,
        activityType: salesActivities.activityType,
        activityDate: salesActivities.activityDate,
        personId: salesActivities.personId,
        customerId: salesActivities.customerId,
        leadId: salesActivities.leadId,
        salesDocId: salesActivities.salesDocId,
        outcome: salesActivities.outcome,
        durationMinutes: salesActivities.durationMinutes,
        discussionPoints: salesActivities.discussionPoints,
        notes: salesActivities.notes,
        internalNotes: salesActivities.internalNotes,
        ourCommitments: salesActivities.ourCommitments,
        theirCommitments: salesActivities.theirCommitments,
        nextAction: salesActivities.nextAction,
        followUpDate: salesActivities.followUpDate,
        followUpNote: salesActivities.followUpNote,
        attachments: salesActivities.attachments,
        performedByActorId: salesActivities.performedByActorId,
        createdAt: salesActivities.createdAt,
        updatedAt: salesActivities.updatedAt,
        // Join person
        personName: people.fullName,
        personEmail: people.primaryEmail,
        personPhone: people.primaryPhone,
        // Join customer (party)
        customerName: parties.name,
        customerCode: parties.code,
        // Join lead
        leadContactName: leads.contactName,
        leadCompany: leads.company,
        leadStatus: leads.status,
        // Join sales doc
        salesDocNumber: salesDocs.docNumber,
        salesDocType: salesDocs.docType,
        salesDocStatus: salesDocs.status,
      })
      .from(salesActivities)
      .leftJoin(people, eq(salesActivities.personId, people.id))
      .leftJoin(parties, eq(salesActivities.customerId, parties.id))
      .leftJoin(leads, eq(salesActivities.leadId, leads.id))
      .leftJoin(salesDocs, eq(salesActivities.salesDocId, salesDocs.id))
      .where(and(eq(salesActivities.id, id), eq(salesActivities.tenantId, tenantId)));

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    return NextResponse.json({
      activity: {
        ...activity,
        person: activity.personId
          ? {
              id: activity.personId,
              fullName: activity.personName,
              primaryEmail: activity.personEmail,
              primaryPhone: activity.personPhone,
            }
          : null,
        customer: activity.customerId
          ? {
              id: activity.customerId,
              name: activity.customerName,
              code: activity.customerCode,
            }
          : null,
        lead: activity.leadId
          ? {
              id: activity.leadId,
              contactName: activity.leadContactName,
              company: activity.leadCompany,
              status: activity.leadStatus,
            }
          : null,
        salesDoc: activity.salesDocId
          ? {
              id: activity.salesDocId,
              docNumber: activity.salesDocNumber,
              docType: activity.salesDocType,
              status: activity.salesDocStatus,
            }
          : null,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales-customers/activities/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/sales-customers/activities/[id]
 * Update an activity
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;
    const body: UpdateActivityRequest = await req.json();

    // Check activity exists
    const [existing] = await db
      .select({ id: salesActivities.id })
      .from(salesActivities)
      .where(and(eq(salesActivities.id, id), eq(salesActivities.tenantId, tenantId)));

    if (!existing) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const updateData: Partial<typeof salesActivities.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.activityType !== undefined) {
      updateData.activityType = body.activityType as typeof salesActivities.activityType.enumValues[number];
    }
    if (body.activityDate !== undefined) {
      updateData.activityDate = new Date(body.activityDate);
    }
    if (body.outcome !== undefined) {
      updateData.outcome = body.outcome as typeof salesActivities.outcome.enumValues[number] | null;
    }
    if (body.durationMinutes !== undefined) {
      updateData.durationMinutes = body.durationMinutes;
    }
    if (body.discussionPoints !== undefined) {
      updateData.discussionPoints = body.discussionPoints;
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes?.trim() || null;
    }
    if (body.internalNotes !== undefined) {
      updateData.internalNotes = body.internalNotes?.trim() || null;
    }
    if (body.ourCommitments !== undefined) {
      updateData.ourCommitments = body.ourCommitments;
    }
    if (body.theirCommitments !== undefined) {
      updateData.theirCommitments = body.theirCommitments;
    }
    if (body.nextAction !== undefined) {
      updateData.nextAction = body.nextAction;
    }
    if (body.followUpDate !== undefined) {
      updateData.followUpDate = body.followUpDate;
    }
    if (body.followUpNote !== undefined) {
      updateData.followUpNote = body.followUpNote?.trim() || null;
    }
    if (body.attachments !== undefined) {
      updateData.attachments = body.attachments;
    }

    const [updated] = await db
      .update(salesActivities)
      .set(updateData)
      .where(and(eq(salesActivities.id, id), eq(salesActivities.tenantId, tenantId)))
      .returning();

    return NextResponse.json({ activity: updated });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/sales-customers/activities/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/sales-customers/activities/[id]
 * Delete an activity
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    // Check activity exists
    const [existing] = await db
      .select({ id: salesActivities.id })
      .from(salesActivities)
      .where(and(eq(salesActivities.id, id), eq(salesActivities.tenantId, tenantId)));

    if (!existing) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    await db
      .delete(salesActivities)
      .where(and(eq(salesActivities.id, id), eq(salesActivities.tenantId, tenantId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/sales-customers/activities/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
