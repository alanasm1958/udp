/**
 * /api/hr-people/persons
 *
 * CRUD endpoints for HR persons
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hrPersons } from "@/db/schema";
import { eq, and, ilike, or, desc } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";

/**
 * GET /api/hr-people/persons
 * List all persons with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const statusFilter = url.searchParams.get("status");
    const typeFilter = url.searchParams.get("type");
    const searchQuery = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "100", 10) || 100, 1), 500);

    const conditions = [eq(hrPersons.tenantId, tenantId)];

    if (statusFilter) {
      conditions.push(eq(hrPersons.status, statusFilter));
    }

    if (typeFilter) {
      conditions.push(eq(hrPersons.employmentType, typeFilter));
    }

    let whereClause = and(...conditions);

    if (searchQuery) {
      whereClause = and(
        ...conditions,
        or(
          ilike(hrPersons.fullName, `%${searchQuery}%`),
          ilike(hrPersons.email, `%${searchQuery}%`),
          ilike(hrPersons.jobTitle, `%${searchQuery}%`)
        )
      );
    }

    const persons = await db
      .select()
      .from(hrPersons)
      .where(whereClause)
      .orderBy(hrPersons.fullName)
      .limit(limit);

    return NextResponse.json({ persons });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/hr-people/persons error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hr-people/persons
 * Create a new person
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);

    const body = await req.json();

    // Validate required fields
    if (!body.full_name) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }
    if (!body.employment_type) {
      return NextResponse.json({ error: "Employment type is required" }, { status: 400 });
    }
    if (!body.hire_date) {
      return NextResponse.json({ error: "Hire date is required" }, { status: 400 });
    }

    // Create person
    const [person] = await db
      .insert(hrPersons)
      .values({
        tenantId,
        // Basic Information
        fullName: body.full_name,
        preferredName: body.preferred_name || null,
        email: body.email || null,
        phone: body.phone || null,
        // Employment Details
        employmentType: body.employment_type,
        jobTitle: body.job_title || null,
        department: body.department || null,
        managerId: body.manager_id || null,
        hireDate: body.hire_date,
        endDate: body.end_date || null,
        // Personal Details
        dateOfBirth: body.date_of_birth || null,
        nationality: body.nationality || null,
        gender: body.gender || null,
        // Address
        addressLine1: body.address_line_1 || null,
        addressLine2: body.address_line_2 || null,
        city: body.city || null,
        region: body.region || null,
        country: body.country || null,
        postalCode: body.postal_code || null,
        // Emergency Contact
        emergencyContactName: body.emergency_contact_name || null,
        emergencyContactPhone: body.emergency_contact_phone || null,
        emergencyContactRelationship: body.emergency_contact_relationship || null,
        // Banking
        bankName: body.bank_name || null,
        bankAccountNumber: body.bank_account_number || null,
        bankRoutingNumber: body.bank_routing_number || null,
        // Tax & Legal
        taxId: body.tax_id || null,
        socialSecurityNumber: body.social_security_number || null,
        workPermitNumber: body.work_permit_number || null,
        workPermitExpiry: body.work_permit_expiry || null,
        // Compensation
        grossSalary: body.gross_salary || null,
        payFrequency: body.pay_frequency || "monthly",
        currency: body.currency || "USD",
        // Benefits
        healthInsurance: body.health_insurance || false,
        pensionContributionPercent: body.pension_contribution_percent || null,
        // Platform Access
        canAccessPlatform: body.can_access_platform || false,
        platformRole: body.platform_role || null,
        // Status
        status: "active",
        // Notes
        notes: body.notes || null,
        // Audit
        createdBy: actor.actorId,
        updatedBy: actor.actorId,
      })
      .returning();

    return NextResponse.json({ person }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/hr-people/persons error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
