/**
 * /api/hr-people/persons/[id]
 *
 * Individual person operations (GET, PATCH, DELETE)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hrPersons } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";

/**
 * GET /api/hr-people/persons/[id]
 * Get a single person by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    const [person] = await db
      .select()
      .from(hrPersons)
      .where(and(eq(hrPersons.id, id), eq(hrPersons.tenantId, tenantId)));

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    return NextResponse.json({ person });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/hr-people/persons/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/hr-people/persons/[id]
 * Update a person
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const { id } = await params;

    // Check if person exists
    const [existing] = await db
      .select()
      .from(hrPersons)
      .where(and(eq(hrPersons.id, id), eq(hrPersons.tenantId, tenantId)));

    if (!existing) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    const body = await req.json();

    // Build update object (only include fields that are provided)
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: actor.actorId,
    };

    // Map body fields to schema fields
    const fieldMappings: Record<string, string> = {
      full_name: "fullName",
      preferred_name: "preferredName",
      email: "email",
      phone: "phone",
      employment_type: "employmentType",
      job_title: "jobTitle",
      department: "department",
      manager_id: "managerId",
      hire_date: "hireDate",
      end_date: "endDate",
      date_of_birth: "dateOfBirth",
      nationality: "nationality",
      gender: "gender",
      address_line_1: "addressLine1",
      address_line_2: "addressLine2",
      city: "city",
      region: "region",
      country: "country",
      postal_code: "postalCode",
      emergency_contact_name: "emergencyContactName",
      emergency_contact_phone: "emergencyContactPhone",
      emergency_contact_relationship: "emergencyContactRelationship",
      bank_name: "bankName",
      bank_account_number: "bankAccountNumber",
      bank_routing_number: "bankRoutingNumber",
      tax_id: "taxId",
      social_security_number: "socialSecurityNumber",
      work_permit_number: "workPermitNumber",
      work_permit_expiry: "workPermitExpiry",
      gross_salary: "grossSalary",
      pay_frequency: "payFrequency",
      currency: "currency",
      health_insurance: "healthInsurance",
      pension_contribution_percent: "pensionContributionPercent",
      can_access_platform: "canAccessPlatform",
      platform_role: "platformRole",
      status: "status",
      notes: "notes",
    };

    for (const [bodyField, schemaField] of Object.entries(fieldMappings)) {
      if (bodyField in body) {
        updateData[schemaField] = body[bodyField];
      }
    }

    const [updated] = await db
      .update(hrPersons)
      .set(updateData)
      .where(eq(hrPersons.id, id))
      .returning();

    return NextResponse.json({ person: updated });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/hr-people/persons/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hr-people/persons/[id]
 * Delete (or deactivate) a person
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const { id } = await params;

    // Check if person exists
    const [existing] = await db
      .select()
      .from(hrPersons)
      .where(and(eq(hrPersons.id, id), eq(hrPersons.tenantId, tenantId)));

    if (!existing) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    // Soft delete by setting status to terminated
    await db
      .update(hrPersons)
      .set({
        status: "terminated",
        endDate: new Date().toISOString().split("T")[0],
        updatedAt: new Date(),
        updatedBy: actor.actorId,
      })
      .where(eq(hrPersons.id, id));

    return NextResponse.json({ success: true, message: "Person terminated" });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/hr-people/persons/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
