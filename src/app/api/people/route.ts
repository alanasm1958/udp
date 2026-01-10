/**
 * /api/people
 *
 * CRUD endpoints for unified People directory.
 * People can have multiple types: staff, contractor, supplier_contact,
 * sales_rep, service_provider, partner_contact, customer_contact
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { people, parties, users, departments, aiTasks } from "@/db/schema";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";
import crypto from "crypto";

// Request types
type PersonType = "staff" | "contractor" | "supplier_contact" | "sales_rep" | "service_provider" | "partner_contact" | "customer_contact";
type ContactChannel = "whatsapp" | "email" | "phone" | "sms";

interface CreatePersonRequest {
  fullName: string;
  displayName?: string;
  types?: PersonType[];

  // Contact info
  primaryEmail?: string;
  secondaryEmails?: string[];
  primaryPhone?: string;
  secondaryPhones?: string[];
  whatsappNumber?: string;

  // Preferences
  preferredChannel?: ContactChannel;
  channelFallbackOrder?: string[];

  // Links
  linkedPartyId?: string;  // Partner organization
  linkedUserId?: string;   // Platform user

  // Employment
  jobTitle?: string;
  departmentId?: string;

  notes?: string;
  isQuickAdd?: boolean;
  metadata?: Record<string, unknown>;
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Check for potential duplicates and create AI task if found
 */
async function checkForDuplicates(
  tenantId: string,
  personId: string,
  email: string | null | undefined,
  phone: string | null | undefined,
  whatsapp: string | null | undefined,
  fullName: string,
  actorId: string
): Promise<void> {
  // Check for user overlap
  if (email) {
    const [matchingUser] = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.email, email)));

    if (matchingUser) {
      const triggerHash = crypto.createHash("md5").update(`link_person_user_${personId}_${matchingUser.id}`).digest("hex");

      // Check if task already exists
      const [existingTask] = await db
        .select({ id: aiTasks.id })
        .from(aiTasks)
        .where(and(eq(aiTasks.tenantId, tenantId), eq(aiTasks.triggerHash, triggerHash)));

      if (!existingTask) {
        await db.insert(aiTasks).values({
          tenantId,
          taskType: "link_person_to_user",
          status: "pending",
          title: `Link "${fullName}" to user account`,
          description: `Person "${fullName}" has the same email (${email}) as user "${matchingUser.fullName}". Should they be linked?`,
          reasoning: "Email address match detected between People directory entry and User account.",
          confidenceScore: "0.95",
          primaryEntityType: "person",
          primaryEntityId: personId,
          secondaryEntityType: "user",
          secondaryEntityId: matchingUser.id,
          suggestedAction: { action: "link", personId, userId: matchingUser.id },
          priority: "normal",
          triggerHash,
          createdByActorId: actorId,
        });
      }
    }
  }

  // Check for people duplicates
  const conditions = [eq(people.tenantId, tenantId), sql`${people.id} != ${personId}`];
  const matchConditions: ReturnType<typeof eq>[] = [];

  if (email) matchConditions.push(eq(people.primaryEmail, email));
  if (phone) matchConditions.push(eq(people.primaryPhone, phone));
  if (whatsapp) matchConditions.push(eq(people.whatsappNumber, whatsapp));

  if (matchConditions.length > 0) {
    const duplicates = await db
      .select({ id: people.id, fullName: people.fullName })
      .from(people)
      .where(and(...conditions, or(...matchConditions)))
      .limit(1);

    if (duplicates.length > 0) {
      const dup = duplicates[0];
      const triggerHash = crypto.createHash("md5").update(`merge_people_${[personId, dup.id].sort().join("_")}`).digest("hex");

      const [existingTask] = await db
        .select({ id: aiTasks.id })
        .from(aiTasks)
        .where(and(eq(aiTasks.tenantId, tenantId), eq(aiTasks.triggerHash, triggerHash)));

      if (!existingTask) {
        await db.insert(aiTasks).values({
          tenantId,
          taskType: "merge_duplicate_people",
          status: "pending",
          title: `Potential duplicate: "${fullName}" and "${dup.fullName}"`,
          description: `These two people records share contact information. Review and merge if they are the same person.`,
          reasoning: "Contact information overlap detected (email, phone, or WhatsApp).",
          confidenceScore: "0.85",
          primaryEntityType: "person",
          primaryEntityId: personId,
          secondaryEntityType: "person",
          secondaryEntityId: dup.id,
          suggestedAction: { action: "merge", keepId: personId, mergeId: dup.id },
          priority: "normal",
          triggerHash,
          createdByActorId: actorId,
        });
      }
    }
  }
}

/**
 * GET /api/people
 * List people with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const typeFilter = url.searchParams.get("type");
    const linkedPartyId = url.searchParams.get("linkedPartyId");
    const isQuickAdd = url.searchParams.get("isQuickAdd");
    const searchQuery = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(people.tenantId, tenantId), eq(people.isActive, true)];

    if (typeFilter) {
      conditions.push(sql`${people.types} @> ${JSON.stringify([typeFilter])}`);
    }

    if (linkedPartyId && isValidUuid(linkedPartyId)) {
      conditions.push(eq(people.linkedPartyId, linkedPartyId));
    }

    if (isQuickAdd === "true") {
      conditions.push(eq(people.isQuickAdd, true));
    }

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      conditions.push(
        or(
          ilike(people.fullName, searchPattern),
          ilike(people.primaryEmail, searchPattern),
          ilike(people.primaryPhone, searchPattern),
          ilike(people.whatsappNumber, searchPattern)
        )!
      );
    }

    const peopleList = await db
      .select({
        id: people.id,
        fullName: people.fullName,
        displayName: people.displayName,
        types: people.types,
        primaryEmail: people.primaryEmail,
        primaryPhone: people.primaryPhone,
        whatsappNumber: people.whatsappNumber,
        preferredChannel: people.preferredChannel,
        linkedPartyId: people.linkedPartyId,
        linkedUserId: people.linkedUserId,
        jobTitle: people.jobTitle,
        isQuickAdd: people.isQuickAdd,
        createdAt: people.createdAt,
      })
      .from(people)
      .where(and(...conditions))
      .orderBy(people.fullName)
      .limit(limit);

    return NextResponse.json({ people: peopleList });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/people error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/people
 * Create a new person
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreatePersonRequest = await req.json();

    // Validate required fields
    if (!body.fullName) {
      return NextResponse.json({ error: "fullName is required" }, { status: 400 });
    }

    // Validate linked party if provided
    if (body.linkedPartyId) {
      if (!isValidUuid(body.linkedPartyId)) {
        return NextResponse.json({ error: "Invalid linkedPartyId format" }, { status: 400 });
      }
      const [party] = await db
        .select({ id: parties.id })
        .from(parties)
        .where(and(eq(parties.tenantId, tenantId), eq(parties.id, body.linkedPartyId)));
      if (!party) {
        return NextResponse.json({ error: "Linked party not found" }, { status: 404 });
      }
    }

    // Validate linked user if provided
    if (body.linkedUserId) {
      if (!isValidUuid(body.linkedUserId)) {
        return NextResponse.json({ error: "Invalid linkedUserId format" }, { status: 400 });
      }
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.id, body.linkedUserId)));
      if (!user) {
        return NextResponse.json({ error: "Linked user not found" }, { status: 404 });
      }
    }

    // Validate department if provided
    if (body.departmentId) {
      if (!isValidUuid(body.departmentId)) {
        return NextResponse.json({ error: "Invalid departmentId format" }, { status: 400 });
      }
      const [dept] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(and(eq(departments.tenantId, tenantId), eq(departments.id, body.departmentId)));
      if (!dept) {
        return NextResponse.json({ error: "Department not found" }, { status: 404 });
      }
    }

    // Create person
    const [person] = await db
      .insert(people)
      .values({
        tenantId,
        fullName: body.fullName,
        displayName: body.displayName ?? null,
        types: body.types ?? ["staff"],
        primaryEmail: body.primaryEmail ?? null,
        secondaryEmails: body.secondaryEmails ?? [],
        primaryPhone: body.primaryPhone ?? null,
        secondaryPhones: body.secondaryPhones ?? [],
        whatsappNumber: body.whatsappNumber ?? null,
        preferredChannel: body.preferredChannel ?? "whatsapp",
        channelFallbackOrder: body.channelFallbackOrder ?? ["whatsapp", "email", "phone"],
        linkedPartyId: body.linkedPartyId ?? null,
        linkedUserId: body.linkedUserId ?? null,
        jobTitle: body.jobTitle ?? null,
        departmentId: body.departmentId ?? null,
        notes: body.notes ?? null,
        isQuickAdd: body.isQuickAdd ?? false,
        metadata: body.metadata ?? {},
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("person", person.id, "person_created", {
      fullName: body.fullName,
      types: body.types,
      isQuickAdd: body.isQuickAdd,
    });

    // Check for duplicates and create AI tasks if needed
    await checkForDuplicates(
      tenantId,
      person.id,
      body.primaryEmail,
      body.primaryPhone,
      body.whatsappNumber,
      body.fullName,
      actor.actorId
    );

    // Create quick-add completion task if applicable
    if (body.isQuickAdd) {
      await db.insert(aiTasks).values({
        tenantId,
        taskType: "complete_quick_add",
        status: "pending",
        title: `Complete profile for "${body.fullName}"`,
        description: `This person was added quickly during a workflow. Please complete their profile with full contact details.`,
        reasoning: "Quick-add records need completion for full functionality.",
        primaryEntityType: "person",
        primaryEntityId: person.id,
        suggestedAction: { action: "complete_profile", personId: person.id },
        priority: "low",
        createdByActorId: actor.actorId,
      });
    }

    return NextResponse.json({ personId: person.id }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/people error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
