/**
 * /api/people/performance-notes
 *
 * POST: Add a performance note for an employee
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { people } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getActorIdFromHeaders,
  getUserIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext, logAuditEvent } from "@/lib/audit";

interface CreatePerformanceNoteRequest {
  personId: string;
  noteType: "praise" | "coaching" | "warning" | "general";
  title: string;
  content: string;
  isPrivate?: boolean;
}

/**
 * POST /api/people/performance-notes
 * Add a performance note for an employee
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdHeader = getActorIdFromHeaders(req);
    const userIdHeader = getUserIdFromHeaders(req);
    const { actorId } = await resolveActor(tenantId, actorIdHeader, userIdHeader);
    const ctx = createAuditContext(tenantId, actorId);

    const body: CreatePerformanceNoteRequest = await req.json();
    const { personId, noteType, title, content, isPrivate } = body;

    // Validate required fields
    if (!personId || !noteType || !title || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify person exists
    const person = await db
      .select({ id: people.id, fullName: people.fullName })
      .from(people)
      .where(
        and(
          eq(people.id, personId),
          eq(people.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!person.length) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    // Log audit event with full note details
    await logAuditEvent({
      ...ctx,
      action: "performance_note_added",
      entityType: "person",
      entityId: personId,
      metadata: {
        noteType,
        title,
        content,
        isPrivate: isPrivate || false,
        personName: person[0].fullName,
      },
    });

    return NextResponse.json({
      success: true,
      note: {
        personId,
        personName: person[0].fullName,
        noteType,
        title,
        isPrivate: isPrivate || false,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/people/performance-notes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
