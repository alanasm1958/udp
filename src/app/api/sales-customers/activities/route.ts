/**
 * /api/sales-customers/activities
 *
 * Sales Activity Recording endpoints
 * GET: List activities with filters
 * POST: Create a new activity
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesActivities, people, parties, leads } from "@/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getActorIdFromHeaders,
  getUserIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";

interface CreateActivityRequest {
  activityType: string;
  activityDate?: string;
  personId?: string | null;
  customerId?: string | null;
  leadId?: string | null;
  salesDocId?: string | null;
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
 * GET /api/sales-customers/activities
 * List activities with optional filters
 * Query params: personId, customerId, leadId, activityType, startDate, endDate, limit, offset
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const personIdFilter = url.searchParams.get("personId");
    const customerIdFilter = url.searchParams.get("customerId");
    const leadIdFilter = url.searchParams.get("leadId");
    const activityTypeFilter = url.searchParams.get("activityType");
    const startDateFilter = url.searchParams.get("startDate");
    const endDateFilter = url.searchParams.get("endDate");
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");

    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);
    const offset = Math.max(parseInt(offsetParam || "0", 10) || 0, 0);

    const conditions = [eq(salesActivities.tenantId, tenantId)];

    if (personIdFilter) {
      conditions.push(eq(salesActivities.personId, personIdFilter));
    }
    if (customerIdFilter) {
      conditions.push(eq(salesActivities.customerId, customerIdFilter));
    }
    if (leadIdFilter) {
      conditions.push(eq(salesActivities.leadId, leadIdFilter));
    }
    if (activityTypeFilter) {
      conditions.push(eq(salesActivities.activityType, activityTypeFilter as typeof salesActivities.activityType.enumValues[number]));
    }
    if (startDateFilter) {
      conditions.push(gte(salesActivities.activityDate, new Date(startDateFilter)));
    }
    if (endDateFilter) {
      conditions.push(lte(salesActivities.activityDate, new Date(endDateFilter)));
    }

    // Get activities with related data
    const items = await db
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
        // Join customer (party)
        customerName: parties.name,
        customerCode: parties.code,
      })
      .from(salesActivities)
      .leftJoin(people, eq(salesActivities.personId, people.id))
      .leftJoin(parties, eq(salesActivities.customerId, parties.id))
      .where(and(...conditions))
      .orderBy(desc(salesActivities.activityDate))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(salesActivities)
      .where(and(...conditions));

    return NextResponse.json({
      activities: items.map((item) => ({
        ...item,
        person: item.personId
          ? { id: item.personId, fullName: item.personName, primaryEmail: item.personEmail }
          : null,
        customer: item.customerId
          ? { id: item.customerId, name: item.customerName, code: item.customerCode }
          : null,
      })),
      total: Number(count),
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales-customers/activities error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/sales-customers/activities
 * Create a new sales activity
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const body: CreateActivityRequest = await req.json();

    if (!body.activityType) {
      return NextResponse.json({ error: "Activity type is required" }, { status: 400 });
    }

    // Validate at least one related entity is provided
    if (!body.personId && !body.customerId && !body.leadId && !body.salesDocId) {
      return NextResponse.json(
        { error: "At least one related entity (person, customer, lead, or sales doc) is required" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(salesActivities)
      .values({
        tenantId,
        activityType: body.activityType as typeof salesActivities.activityType.enumValues[number],
        activityDate: body.activityDate ? new Date(body.activityDate) : new Date(),
        personId: body.personId || null,
        customerId: body.customerId || null,
        leadId: body.leadId || null,
        salesDocId: body.salesDocId || null,
        outcome: (body.outcome as typeof salesActivities.outcome.enumValues[number]) || null,
        durationMinutes: body.durationMinutes || null,
        discussionPoints: body.discussionPoints || [],
        notes: body.notes?.trim() || null,
        internalNotes: body.internalNotes?.trim() || null,
        ourCommitments: body.ourCommitments || [],
        theirCommitments: body.theirCommitments || [],
        nextAction: body.nextAction || null,
        followUpDate: body.followUpDate || null,
        followUpNote: body.followUpNote?.trim() || null,
        attachments: body.attachments || [],
        performedByActorId: actor.actorId,
      })
      .returning();

    // Update lead's last activity date if linked
    if (body.leadId) {
      await db
        .update(leads)
        .set({
          lastActivityDate: new Date(),
          activityCount: sql`COALESCE(${leads.activityCount}, 0) + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(leads.id, body.leadId), eq(leads.tenantId, tenantId)));
    }

    return NextResponse.json({ activity: created }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/sales-customers/activities error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
