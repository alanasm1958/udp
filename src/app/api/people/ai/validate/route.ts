import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { people, users } from "@/db/schema";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/* =============================================================================
   TYPES
   ============================================================================= */

interface RequestBody {
  fullName?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  whatsappNumber?: string;
  types?: string[];
}

interface AIHint {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  suggestion?: string;
  actionLabel?: string;
  actionValue?: unknown;
  metadata?: Record<string, unknown>;
}

/* =============================================================================
   ANALYSIS FUNCTIONS
   ============================================================================= */

/**
 * Check for potential duplicate people by name
 */
async function checkDuplicateName(
  tenantId: string,
  fullName: string | undefined
): Promise<AIHint | null> {
  if (!fullName || fullName.length < 3) return null;

  // Search for similar names
  const matches = await db
    .select({
      id: people.id,
      fullName: people.fullName,
      primaryEmail: people.primaryEmail,
      primaryPhone: people.primaryPhone,
    })
    .from(people)
    .where(
      and(
        eq(people.tenantId, tenantId),
        eq(people.isActive, true),
        ilike(people.fullName, `%${fullName}%`)
      )
    )
    .limit(3);

  if (matches.length > 0) {
    const names = matches.map((m) => m.fullName).join(", ");
    return {
      id: `duplicate-name-${fullName.toLowerCase().replace(/\s+/g, "-")}`,
      type: "duplicate_detection",
      severity: matches.some((m) => m.fullName.toLowerCase() === fullName.toLowerCase()) ? "warning" : "info",
      title: "Similar Name Found",
      message: `Found ${matches.length} person(s) with similar names: ${names}`,
      suggestion: "Please verify this is not a duplicate entry.",
      metadata: {
        matches: matches.map((m) => ({
          id: m.id,
          fullName: m.fullName,
          email: m.primaryEmail,
          phone: m.primaryPhone,
        })),
      },
    };
  }

  return null;
}

/**
 * Check for duplicate email
 */
async function checkDuplicateEmail(
  tenantId: string,
  email: string | undefined
): Promise<AIHint | null> {
  if (!email) return null;

  // Check people table
  const personMatch = await db
    .select({
      id: people.id,
      fullName: people.fullName,
    })
    .from(people)
    .where(
      and(
        eq(people.tenantId, tenantId),
        eq(people.isActive, true),
        eq(sql`LOWER(${people.primaryEmail})`, email.toLowerCase())
      )
    )
    .limit(1);

  if (personMatch.length > 0) {
    return {
      id: `duplicate-email-person-${email}`,
      type: "duplicate_detection",
      severity: "critical",
      title: "Email Already Exists",
      message: `This email is already used by "${personMatch[0].fullName}" in the People directory.`,
      suggestion: "Use a different email or find the existing record.",
      metadata: {
        existingPersonId: personMatch[0].id,
        existingName: personMatch[0].fullName,
      },
    };
  }

  // Check users table
  const userMatch = await db
    .select({
      id: users.id,
      fullName: users.fullName,
    })
    .from(users)
    .where(
      and(
        eq(users.tenantId, tenantId),
        eq(sql`LOWER(${users.email})`, email.toLowerCase())
      )
    )
    .limit(1);

  if (userMatch.length > 0) {
    return {
      id: `duplicate-email-user-${email}`,
      type: "user_link_suggestion",
      severity: "info",
      title: "Matching User Account Found",
      message: `This email matches user "${userMatch[0].fullName}". They can be linked after creation.`,
      suggestion: "After adding, an AI task will prompt you to link them.",
      metadata: {
        matchingUserId: userMatch[0].id,
        matchingUserName: userMatch[0].fullName,
      },
    };
  }

  return null;
}

/**
 * Check for duplicate phone
 */
async function checkDuplicatePhone(
  tenantId: string,
  phone: string | undefined,
  whatsapp: string | undefined
): Promise<AIHint | null> {
  const phoneToCheck = phone || whatsapp;
  if (!phoneToCheck) return null;

  // Normalize phone (remove non-digits for comparison)
  const normalized = phoneToCheck.replace(/\D/g, "");
  if (normalized.length < 7) return null;

  // Search for matching phones
  const matches = await db
    .select({
      id: people.id,
      fullName: people.fullName,
      primaryPhone: people.primaryPhone,
      whatsappNumber: people.whatsappNumber,
    })
    .from(people)
    .where(
      and(
        eq(people.tenantId, tenantId),
        eq(people.isActive, true),
        or(
          sql`REGEXP_REPLACE(${people.primaryPhone}, '[^0-9]', '', 'g') LIKE '%' || ${normalized} || '%'`,
          sql`REGEXP_REPLACE(${people.whatsappNumber}, '[^0-9]', '', 'g') LIKE '%' || ${normalized} || '%'`
        )
      )
    )
    .limit(1);

  if (matches.length > 0) {
    return {
      id: `duplicate-phone-${normalized}`,
      type: "duplicate_detection",
      severity: "warning",
      title: "Phone Number May Be Duplicate",
      message: `This phone number is similar to one used by "${matches[0].fullName}".`,
      suggestion: "Verify this is a different person.",
      metadata: {
        existingPersonId: matches[0].id,
        existingName: matches[0].fullName,
        existingPhone: matches[0].primaryPhone || matches[0].whatsappNumber,
      },
    };
  }

  return null;
}

/**
 * Validate contact info completeness
 */
function checkContactCompleteness(
  email: string | undefined,
  phone: string | undefined,
  whatsapp: string | undefined
): AIHint | null {
  const hasContact = email || phone || whatsapp;

  if (!hasContact) {
    return {
      id: "missing-contact-info",
      type: "completeness_warning",
      severity: "info",
      title: "No Contact Info",
      message: "This person has no email, phone, or WhatsApp number.",
      suggestion: "Consider adding at least one contact method for communication.",
    };
  }

  return null;
}

/* =============================================================================
   MAIN HANDLER
   ============================================================================= */

/**
 * POST /api/people/ai/validate
 * Validates person form inputs and returns AI hints
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const body: RequestBody = await request.json();
    const { fullName, primaryEmail, primaryPhone, whatsappNumber } = body;

    const hints: AIHint[] = [];
    const analysisId = `person-${Date.now()}`;

    // Run all analyses in parallel
    const [nameHint, emailHint, phoneHint] = await Promise.all([
      checkDuplicateName(tenantId, fullName),
      checkDuplicateEmail(tenantId, primaryEmail),
      checkDuplicatePhone(tenantId, primaryPhone, whatsappNumber),
    ]);

    // Check completeness (sync)
    const completenessHint = checkContactCompleteness(primaryEmail, primaryPhone, whatsappNumber);

    if (nameHint) hints.push(nameHint);
    if (emailHint) hints.push(emailHint);
    if (phoneHint) hints.push(phoneHint);
    if (completenessHint) hints.push(completenessHint);

    // Sort by severity and limit
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    const sortedHints = hints
      .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
      .slice(0, 5);

    return NextResponse.json({
      hints: sortedHints,
      analysisId,
    });
  } catch (error) {
    console.error("Validate person error:", error);
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    // Graceful degradation
    return NextResponse.json({
      hints: [],
      analysisId: `error-${Date.now()}`,
      error: "Analysis temporarily unavailable",
    });
  }
}
