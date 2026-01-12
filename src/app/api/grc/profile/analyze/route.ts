/**
 * /api/grc/profile/analyze
 *
 * POST: Trigger AI analysis of business profile to generate requirements
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { businessProfiles, grcRequirements, grcTasks, grcAlerts } from "@/db/schema";
import { eq } from "drizzle-orm";

// Requirement templates based on business characteristics
const REQUIREMENT_TEMPLATES = {
  // Tax requirements
  federal_income_tax: {
    code: "FED-TAX-INCOME",
    title: "Federal Income Tax Filing",
    description: "File annual federal income tax return (Form 1120 for corporations, 1065 for partnerships)",
    category: "tax" as const,
    riskLevel: "high" as const,
    closureCriteria: {
      required_documents: ["tax_return_filed"],
      required_fields: ["filing_confirmation_number", "tax_year"],
    },
    appliesToStructure: ["LLC", "Corporation", "S-Corp", "Partnership"],
  },
  state_income_tax: {
    code: "STATE-TAX-INCOME",
    title: "State Income Tax Filing",
    description: "File state income tax returns in all operating jurisdictions",
    category: "tax" as const,
    riskLevel: "high" as const,
    closureCriteria: {
      required_documents: ["state_tax_return"],
      required_fields: ["state", "filing_date"],
    },
    appliesToStructure: ["LLC", "Corporation", "S-Corp", "Partnership"],
  },
  sales_tax_registration: {
    code: "SALES-TAX-REG",
    title: "Sales Tax Registration",
    description: "Register for sales tax permit in states where you have nexus",
    category: "tax" as const,
    riskLevel: "high" as const,
    closureCriteria: {
      required_documents: ["sales_tax_permit"],
      required_fields: ["permit_number", "state"],
    },
    triggers: { hasPhysicalPresence: true },
  },
  payroll_tax: {
    code: "PAYROLL-TAX",
    title: "Payroll Tax Compliance",
    description: "Withhold and remit federal and state payroll taxes",
    category: "tax" as const,
    riskLevel: "critical" as const,
    closureCriteria: {
      required_documents: ["payroll_tax_deposit_receipt"],
      required_fields: ["deposit_date", "amount"],
    },
    triggers: { hasEmployees: true },
  },
  // Labor requirements
  workers_comp: {
    code: "LABOR-WORKERS-COMP",
    title: "Workers Compensation Insurance",
    description: "Maintain workers compensation insurance coverage",
    category: "labor" as const,
    riskLevel: "critical" as const,
    closureCriteria: {
      required_documents: ["workers_comp_policy"],
      required_fields: ["policy_number", "effective_date", "expiration_date"],
      validity_rules: { expiration_check: true, renewal_days_before: 30 },
    },
    triggers: { hasEmployees: true },
  },
  i9_compliance: {
    code: "LABOR-I9",
    title: "I-9 Employment Verification",
    description: "Complete Form I-9 for all employees within 3 days of hire",
    category: "labor" as const,
    riskLevel: "high" as const,
    closureCriteria: {
      required_fields: ["verification_process_documented"],
    },
    triggers: { hasEmployees: true },
  },
  minimum_wage: {
    code: "LABOR-MIN-WAGE",
    title: "Minimum Wage Compliance",
    description: "Ensure all employees are paid at least minimum wage",
    category: "labor" as const,
    riskLevel: "high" as const,
    closureCriteria: {
      required_fields: ["wage_policy_documented", "last_review_date"],
    },
    triggers: { hasEmployees: true },
  },
  // Licensing requirements
  business_license: {
    code: "LICENSE-BUSINESS",
    title: "Business License",
    description: "Obtain and maintain business license in operating jurisdictions",
    category: "licensing" as const,
    riskLevel: "high" as const,
    closureCriteria: {
      required_documents: ["business_license"],
      required_fields: ["license_number", "issue_date", "expiration_date"],
      validity_rules: { expiration_check: true, renewal_days_before: 60 },
    },
  },
  professional_license: {
    code: "LICENSE-PROFESSIONAL",
    title: "Professional Licenses",
    description: "Maintain required professional licenses for regulated activities",
    category: "licensing" as const,
    riskLevel: "critical" as const,
    closureCriteria: {
      required_documents: ["professional_license"],
      required_fields: ["license_type", "license_number", "expiration_date"],
      validity_rules: { expiration_check: true, renewal_days_before: 90 },
    },
    triggers: { hasRegulatedActivities: true },
  },
  // Data privacy requirements
  privacy_policy: {
    code: "PRIVACY-POLICY",
    title: "Privacy Policy",
    description: "Publish and maintain a privacy policy compliant with applicable laws",
    category: "data_privacy" as const,
    riskLevel: "medium" as const,
    closureCriteria: {
      required_documents: ["privacy_policy"],
      required_fields: ["last_updated_date", "published_url"],
    },
    triggers: { collectsPersonalData: true },
  },
  ccpa_compliance: {
    code: "PRIVACY-CCPA",
    title: "CCPA Compliance",
    description: "Comply with California Consumer Privacy Act requirements",
    category: "data_privacy" as const,
    riskLevel: "high" as const,
    closureCriteria: {
      required_documents: ["ccpa_policy"],
      required_fields: ["opt_out_mechanism", "data_request_process"],
    },
    triggers: { operatesInCA: true, revenueOver25M: true },
  },
  // Insurance requirements
  general_liability: {
    code: "INSURANCE-GL",
    title: "General Liability Insurance",
    description: "Maintain general liability insurance coverage",
    category: "insurance" as const,
    riskLevel: "high" as const,
    closureCriteria: {
      required_documents: ["gl_policy", "certificate_of_insurance"],
      required_fields: ["policy_number", "coverage_amount", "expiration_date"],
      validity_rules: { expiration_check: true, renewal_days_before: 30 },
    },
  },
  // Corporate governance
  annual_report: {
    code: "CORP-ANNUAL-REPORT",
    title: "Annual Report Filing",
    description: "File annual report with Secretary of State",
    category: "corporate_governance" as const,
    riskLevel: "medium" as const,
    closureCriteria: {
      required_documents: ["annual_report_receipt"],
      required_fields: ["filing_date", "confirmation_number"],
    },
    appliesToStructure: ["LLC", "Corporation", "S-Corp"],
  },
  registered_agent: {
    code: "CORP-REG-AGENT",
    title: "Registered Agent",
    description: "Maintain a registered agent in state of incorporation",
    category: "corporate_governance" as const,
    riskLevel: "medium" as const,
    closureCriteria: {
      required_fields: ["agent_name", "agent_address"],
    },
    appliesToStructure: ["LLC", "Corporation", "S-Corp"],
  },
};

interface BusinessProfile {
  legalStructure: string | null;
  jurisdiction: string | null;
  employeeCount: number | null;
  annualRevenue: string | null;
  operatingLocations: Array<{ state?: string; country?: string }>;
  businessActivities: string[];
  regulatedActivities: string[];
}

function analyzeProfile(profile: BusinessProfile) {
  const requirements: Array<{
    code: string;
    title: string;
    description: string;
    category: "tax" | "labor" | "licensing" | "environmental" | "data_privacy" | "financial" | "health_safety" | "insurance" | "corporate_governance";
    riskLevel: "low" | "medium" | "high" | "critical";
    closureCriteria: object;
    aiExplanation: string;
  }> = [];

  const hasEmployees = (profile.employeeCount || 0) > 0;
  const hasRegulatedActivities = (profile.regulatedActivities || []).length > 0;
  const operatesInCA = (profile.operatingLocations || []).some(
    (loc) => loc.state === "CA" || loc.state === "California"
  );
  const revenueOver25M = parseFloat(profile.annualRevenue || "0") > 25000000;
  const structure = profile.legalStructure || "";

  // Federal Income Tax - applies to most businesses
  if (["LLC", "Corporation", "S-Corp", "Partnership"].includes(structure)) {
    const template = REQUIREMENT_TEMPLATES.federal_income_tax;
    requirements.push({
      ...template,
      aiExplanation: `As a ${structure}, you are required to file federal income tax returns annually.`,
    });
  }

  // State Income Tax
  if (profile.jurisdiction) {
    const template = REQUIREMENT_TEMPLATES.state_income_tax;
    requirements.push({
      ...template,
      aiExplanation: `Operating in ${profile.jurisdiction} requires state income tax filing.`,
    });
  }

  // Sales Tax Registration - if physical presence
  if ((profile.operatingLocations || []).length > 0) {
    const template = REQUIREMENT_TEMPLATES.sales_tax_registration;
    const states = (profile.operatingLocations || [])
      .map((l) => l.state)
      .filter(Boolean)
      .join(", ");
    requirements.push({
      ...template,
      aiExplanation: `Physical presence in ${states || "multiple states"} may create sales tax nexus.`,
    });
  }

  // Payroll Tax - if has employees
  if (hasEmployees) {
    const template = REQUIREMENT_TEMPLATES.payroll_tax;
    requirements.push({
      ...template,
      aiExplanation: `With ${profile.employeeCount} employees, you must withhold and remit payroll taxes.`,
    });
  }

  // Workers Comp - if has employees
  if (hasEmployees) {
    const template = REQUIREMENT_TEMPLATES.workers_comp;
    requirements.push({
      ...template,
      aiExplanation: `Workers compensation insurance is required for your ${profile.employeeCount} employees.`,
    });
  }

  // I-9 Compliance - if has employees
  if (hasEmployees) {
    const template = REQUIREMENT_TEMPLATES.i9_compliance;
    requirements.push({
      ...template,
      aiExplanation: `Federal law requires I-9 verification for all employees.`,
    });
  }

  // Minimum Wage - if has employees
  if (hasEmployees) {
    const template = REQUIREMENT_TEMPLATES.minimum_wage;
    requirements.push({
      ...template,
      aiExplanation: `You must comply with federal and state minimum wage laws.`,
    });
  }

  // Business License - general requirement
  const bizLicenseTemplate = REQUIREMENT_TEMPLATES.business_license;
  requirements.push({
    ...bizLicenseTemplate,
    aiExplanation: `A business license is required to operate in ${profile.jurisdiction || "your jurisdiction"}.`,
  });

  // Professional License - if regulated activities
  if (hasRegulatedActivities) {
    const template = REQUIREMENT_TEMPLATES.professional_license;
    requirements.push({
      ...template,
      aiExplanation: `Your regulated activities (${profile.regulatedActivities?.join(", ")}) require professional licensing.`,
    });
  }

  // Privacy Policy - modern businesses generally need this
  const privacyTemplate = REQUIREMENT_TEMPLATES.privacy_policy;
  requirements.push({
    ...privacyTemplate,
    aiExplanation: `A privacy policy is recommended for all businesses that collect customer data.`,
  });

  // CCPA - California businesses with revenue > $25M
  if (operatesInCA && revenueOver25M) {
    const template = REQUIREMENT_TEMPLATES.ccpa_compliance;
    requirements.push({
      ...template,
      aiExplanation: `With operations in California and revenue over $25M, CCPA compliance is required.`,
    });
  }

  // General Liability Insurance
  const glTemplate = REQUIREMENT_TEMPLATES.general_liability;
  requirements.push({
    ...glTemplate,
    aiExplanation: `General liability insurance protects your business from third-party claims.`,
  });

  // Annual Report - for formal entities
  if (["LLC", "Corporation", "S-Corp"].includes(structure)) {
    const template = REQUIREMENT_TEMPLATES.annual_report;
    requirements.push({
      ...template,
      aiExplanation: `${structure}s must file annual reports with the Secretary of State.`,
    });
  }

  // Registered Agent - for formal entities
  if (["LLC", "Corporation", "S-Corp"].includes(structure)) {
    const template = REQUIREMENT_TEMPLATES.registered_agent;
    requirements.push({
      ...template,
      aiExplanation: `A registered agent is required for your ${structure} in ${profile.jurisdiction || "state of incorporation"}.`,
    });
  }

  return requirements;
}

/**
 * POST /api/grc/profile/analyze
 * Analyze business profile and generate/update requirements
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    // Get current profile
    const [profile] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.tenantId, tenantId))
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { error: "Business profile not found. Please create a profile first." },
        { status: 404 }
      );
    }

    // Analyze profile and generate requirements
    const analysisResults = analyzeProfile({
      legalStructure: profile.legalStructure,
      jurisdiction: profile.jurisdiction,
      employeeCount: profile.employeeCount,
      annualRevenue: profile.annualRevenue,
      operatingLocations: profile.operatingLocations as Array<{ state?: string; country?: string }>,
      businessActivities: profile.businessActivities as string[],
      regulatedActivities: profile.regulatedActivities as string[],
    });

    // Get existing requirements
    const existingRequirements = await db
      .select({ requirementCode: grcRequirements.requirementCode })
      .from(grcRequirements)
      .where(eq(grcRequirements.tenantId, tenantId));

    const existingCodes = new Set(existingRequirements.map((r) => r.requirementCode));

    // Create new requirements (skip existing ones)
    let requirementsCreated = 0;
    let tasksGenerated = 0;

    for (const req of analysisResults) {
      if (existingCodes.has(req.code)) {
        continue; // Skip existing requirements
      }

      // Create requirement
      const [newReq] = await db
        .insert(grcRequirements)
        .values({
          tenantId,
          requirementCode: req.code,
          title: req.title,
          description: req.description,
          category: req.category,
          riskLevel: req.riskLevel,
          status: "unsatisfied",
          closureCriteria: req.closureCriteria,
          aiExplanation: req.aiExplanation,
          aiConfidence: "0.85",
          isActive: true,
        })
        .returning();

      requirementsCreated++;

      // Create initial task for the requirement
      await db.insert(grcTasks).values({
        tenantId,
        requirementId: newReq.id,
        title: `Complete: ${req.title}`,
        description: `Gather required documents and information to satisfy this compliance requirement.`,
        actionType: "gather_evidence",
        status: "open",
      });

      tasksGenerated++;

      // Create alert for high/critical requirements
      if (req.riskLevel === "high" || req.riskLevel === "critical") {
        await db.insert(grcAlerts).values({
          tenantId,
          requirementId: newReq.id,
          title: `Action Required: ${req.title}`,
          message: `This ${req.riskLevel} risk requirement needs attention.`,
          alertType: "requirement_unsatisfied",
          severity: req.riskLevel === "critical" ? "critical" : "warning",
          status: "active",
        });
      }
    }

    // Update profile with analysis timestamp
    await db
      .update(businessProfiles)
      .set({
        lastAnalyzedAt: new Date(),
        aiAnalysis: {
          analyzedAt: new Date().toISOString(),
          requirementsIdentified: analysisResults.length,
          requirementsCreated,
          riskAreas: [...new Set(analysisResults.map((r) => r.category))],
        },
        confidenceScore: "0.85",
      })
      .where(eq(businessProfiles.id, profile.id));

    return NextResponse.json({
      success: true,
      analysis: {
        totalIdentified: analysisResults.length,
        requirementsCreated,
        tasksGenerated,
        existingSkipped: analysisResults.length - requirementsCreated,
        riskAreas: [...new Set(analysisResults.map((r) => r.category))],
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/grc/profile/analyze error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
