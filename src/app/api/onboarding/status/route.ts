/**
 * /api/onboarding/status
 *
 * GET: Check onboarding completion status
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { tenants, tenantLegalProfiles, accounts, parties } from "@/db/schema";
import { eq } from "drizzle-orm";

interface OnboardingStatus {
  isComplete: boolean;
  currentStep: number;
  steps: {
    step: number;
    name: string;
    completed: boolean;
  }[];
}

/**
 * GET /api/onboarding/status
 * Returns the current onboarding status and next step
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    // Get tenant
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Check if already complete
    // @ts-expect-error - onboardingCompleted may not be in type yet
    if (tenant.onboardingCompleted) {
      return NextResponse.json({
        isComplete: true,
        currentStep: 5,
        steps: [
          { step: 1, name: "Company Profile", completed: true },
          { step: 2, name: "Chart of Accounts", completed: true },
          { step: 3, name: "First Customer", completed: true },
          { step: 4, name: "Sample Invoice", completed: true },
          { step: 5, name: "Complete", completed: true },
        ],
      } as OnboardingStatus);
    }

    // Check step 1: Company profile
    const [legalProfile] = await db
      .select()
      .from(tenantLegalProfiles)
      .where(eq(tenantLegalProfiles.tenantId, tenantId))
      .limit(1);

    const step1Complete = !!legalProfile;

    // Check step 2: Chart of accounts
    const accountList = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.tenantId, tenantId))
      .limit(5);

    const step2Complete = accountList.length >= 5; // At least 5 accounts from template

    // Check step 3: First customer (party with type = customer)
    const customerList = await db
      .select({ id: parties.id })
      .from(parties)
      .where(eq(parties.tenantId, tenantId))
      .limit(1);

    const step3Complete = customerList.length > 0;

    // Step 4 is optional (sample invoice)
    const step4Complete = step3Complete; // Allow to proceed if they have a customer

    // Determine current step
    let currentStep = 1;
    if (step1Complete) currentStep = 2;
    if (step1Complete && step2Complete) currentStep = 3;
    if (step1Complete && step2Complete && step3Complete) currentStep = 4;
    if (step1Complete && step2Complete && step3Complete && step4Complete) currentStep = 5;

    return NextResponse.json({
      isComplete: false,
      currentStep,
      steps: [
        { step: 1, name: "Company Profile", completed: step1Complete },
        { step: 2, name: "Chart of Accounts", completed: step2Complete },
        { step: 3, name: "First Customer", completed: step3Complete },
        { step: 4, name: "Sample Invoice", completed: step4Complete },
        { step: 5, name: "Complete", completed: false },
      ],
    } as OnboardingStatus);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/onboarding/status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
